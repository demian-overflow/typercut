use anyhow::{anyhow, Result};
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

use crate::entity::material::{self, ActiveModel, Column, Entity as Material};

pub async fn create(
    db: &DatabaseConnection,
    user_id: Uuid,
    title: &str,
    content: &str,
) -> Result<material::Model> {
    let active = ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        title: Set(title.to_string()),
        content: Set(content.to_string()),
        ..Default::default()
    };
    Ok(active.insert(db).await?)
}

pub async fn list_by_user(
    db: &DatabaseConnection,
    user_id: Uuid,
) -> Result<Vec<material::Model>> {
    Ok(Material::find()
        .filter(Column::UserId.eq(user_id))
        .order_by_desc(Column::CreatedAt)
        .all(db)
        .await?)
}

pub async fn find_by_id(
    db: &DatabaseConnection,
    id: Uuid,
    user_id: Uuid,
) -> Result<Option<material::Model>> {
    Ok(Material::find_by_id(id)
        .filter(Column::UserId.eq(user_id))
        .one(db)
        .await?)
}

pub async fn find_by_id_required(
    db: &DatabaseConnection,
    id: Uuid,
    user_id: Uuid,
) -> Result<material::Model> {
    find_by_id(db, id, user_id)
        .await?
        .ok_or_else(|| anyhow!("material {id} not found"))
}

pub async fn delete(db: &DatabaseConnection, id: Uuid, user_id: Uuid) -> Result<bool> {
    let result = Material::delete_by_id(id)
        .filter(Column::UserId.eq(user_id))
        .exec(db)
        .await?;
    Ok(result.rows_affected > 0)
}
