use anyhow::{anyhow, Result};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use uuid::Uuid;

use crate::entity::user::{self, ActiveModel, Column, Entity as User};

pub struct UpsertInput<'a> {
    pub google_id: &'a str,
    pub email: &'a str,
    pub name: &'a str,
    pub picture: Option<&'a str>,
}

/// Insert or update a user by google_id. Returns the persisted model.
pub async fn upsert(db: &DatabaseConnection, input: UpsertInput<'_>) -> Result<user::Model> {
    // Try to find an existing user first.
    if let Some(existing) = find_by_google_id(db, input.google_id).await? {
        // Update mutable fields if they changed.
        let mut active: ActiveModel = existing.into();
        active.email = Set(input.email.to_string());
        active.name = Set(input.name.to_string());
        active.picture = Set(input.picture.map(str::to_string));
        let updated = active.update(db).await?;
        return Ok(updated);
    }

    // First login — insert a new row.
    let active = ActiveModel {
        id: Set(Uuid::new_v4()),
        google_id: Set(input.google_id.to_string()),
        email: Set(input.email.to_string()),
        name: Set(input.name.to_string()),
        picture: Set(input.picture.map(str::to_string)),
        ..Default::default()
    };
    let inserted = active.insert(db).await?;
    Ok(inserted)
}

pub async fn find_by_google_id(
    db: &DatabaseConnection,
    google_id: &str,
) -> Result<Option<user::Model>> {
    Ok(User::find()
        .filter(Column::GoogleId.eq(google_id))
        .one(db)
        .await?)
}

pub async fn find_by_id(db: &DatabaseConnection, id: Uuid) -> Result<Option<user::Model>> {
    Ok(User::find_by_id(id).one(db).await?)
}

pub async fn find_by_id_required(db: &DatabaseConnection, id: Uuid) -> Result<user::Model> {
    find_by_id(db, id)
        .await?
        .ok_or_else(|| anyhow!("user {id} not found"))
}
