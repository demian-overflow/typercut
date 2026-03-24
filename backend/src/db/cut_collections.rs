use anyhow::Result;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

use crate::entity::cut_collection::{self, ActiveModel, Column, Entity as CutCollection};

pub async fn create(
    db: &DatabaseConnection,
    user_id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<cut_collection::Model> {
    let active = ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        name: Set(name.to_string()),
        description: Set(description.map(str::to_string)),
        ..Default::default()
    };
    Ok(active.insert(db).await?)
}

pub async fn list_by_user(
    db: &DatabaseConnection,
    user_id: Uuid,
) -> Result<Vec<cut_collection::Model>> {
    Ok(CutCollection::find()
        .filter(Column::UserId.eq(user_id))
        .order_by_desc(Column::CreatedAt)
        .all(db)
        .await?)
}

pub async fn find_by_id(
    db: &DatabaseConnection,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<cut_collection::Model>> {
    Ok(CutCollection::find_by_id(id)
        .filter(Column::UserId.eq(user_id))
        .one(db)
        .await?)
}

pub async fn update(
    db: &DatabaseConnection,
    id: Uuid,
    user_id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Option<cut_collection::Model>> {
    let Some(existing) = find_by_id(db, id, user_id).await? else {
        return Ok(None);
    };
    let mut active: ActiveModel = existing.into();
    active.name = Set(name.to_string());
    active.description = Set(description.map(str::to_string));
    Ok(Some(active.update(db).await?))
}

pub async fn delete(db: &DatabaseConnection, id: Uuid, user_id: Uuid) -> Result<bool> {
    let result = CutCollection::delete_by_id(id)
        .filter(Column::UserId.eq(user_id))
        .exec(db)
        .await?;
    Ok(result.rows_affected > 0)
}
