use anyhow::Result;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, DatabaseConnection, EntityTrait, QueryFilter,
    ColumnTrait,
};
use uuid::Uuid;

use crate::entity::session::{self, ActiveModel};

pub async fn create(
    db: &DatabaseConnection,
    user_id: Uuid,
    snippet_id: Option<Uuid>,
    text: String,
    source: &str,
) -> Result<session::Model> {
    let model = ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        snippet_id: Set(snippet_id),
        text: Set(text),
        source: Set(source.to_string()),
        status: Set("in_progress".to_string()),
        wpm: Set(None),
        accuracy: Set(None),
        duration_seconds: Set(None),
        total_keystrokes: Set(None),
        correct_keystrokes: Set(None),
        started_at: Set(chrono::Utc::now().into()),
        completed_at: Set(None),
        created_at: Set(chrono::Utc::now().into()),
    };
    let inserted = model.insert(db).await?;
    Ok(inserted)
}

pub struct CompleteInput {
    pub wpm: f64,
    pub accuracy: f64,
    pub duration_seconds: f64,
    pub total_keystrokes: i32,
    pub correct_keystrokes: i32,
}

pub async fn complete(
    db: &DatabaseConnection,
    session_id: Uuid,
    user_id: Uuid,
    stats: CompleteInput,
) -> Result<Option<session::Model>> {
    let existing = session::Entity::find_by_id(session_id)
        .filter(session::Column::UserId.eq(user_id))
        .one(db)
        .await?;

    let Some(model) = existing else { return Ok(None) };

    let mut active: ActiveModel = model.into();
    active.status = Set("completed".to_string());
    active.wpm = Set(Some(rust_decimal::Decimal::try_from(stats.wpm).unwrap_or_default()));
    active.accuracy = Set(Some(rust_decimal::Decimal::try_from(stats.accuracy).unwrap_or_default()));
    active.duration_seconds = Set(Some(rust_decimal::Decimal::try_from(stats.duration_seconds).unwrap_or_default()));
    active.total_keystrokes = Set(Some(stats.total_keystrokes));
    active.correct_keystrokes = Set(Some(stats.correct_keystrokes));
    active.completed_at = Set(Some(chrono::Utc::now().into()));

    let updated = active.update(db).await?;
    Ok(Some(updated))
}

pub async fn abandon(
    db: &DatabaseConnection,
    session_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
    let existing = session::Entity::find_by_id(session_id)
        .filter(session::Column::UserId.eq(user_id))
        .one(db)
        .await?;

    let Some(model) = existing else { return Ok(false) };
    let mut active: ActiveModel = model.into();
    active.status = Set("abandoned".to_string());
    active.completed_at = Set(Some(chrono::Utc::now().into()));
    active.update(db).await?;
    Ok(true)
}
