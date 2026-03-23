use anyhow::Result;
use sea_orm::{
    ActiveModelTrait, ActiveValue::Set, ColumnTrait, DatabaseConnection, EntityTrait, JoinType,
    QueryFilter, QueryOrder, QuerySelect, RelationTrait,
};
use sea_orm::sea_query::{Expr, Order};
use uuid::Uuid;

use crate::entity::material;
use crate::entity::snippet::{self, ActiveModel, Column, Entity as Snippet, Relation};

pub struct SnippetInput {
    pub text: String,
    pub word_count: i32,
}

pub async fn insert_batch(
    db: &DatabaseConnection,
    material_id: Uuid,
    user_id: Uuid,
    inputs: Vec<SnippetInput>,
) -> Result<Vec<snippet::Model>> {
    let mut results = Vec::with_capacity(inputs.len());
    for input in inputs {
        let active = ActiveModel {
            id: Set(Uuid::new_v4()),
            material_id: Set(material_id),
            user_id: Set(user_id),
            text: Set(input.text),
            word_count: Set(input.word_count),
            ..Default::default()
        };
        results.push(active.insert(db).await?);
    }
    Ok(results)
}

pub async fn list_by_material(
    db: &DatabaseConnection,
    material_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<snippet::Model>> {
    Ok(Snippet::find()
        .filter(Column::MaterialId.eq(material_id))
        .filter(Column::UserId.eq(user_id))
        .order_by_asc(Column::CreatedAt)
        .all(db)
        .await?)
}

/// Returns all snippets belonging to a cut collection (via their parent materials).
pub async fn list_by_collection(
    db: &DatabaseConnection,
    collection_id: Uuid,
    user_id: Uuid,
) -> Result<Vec<snippet::Model>> {
    Ok(Snippet::find()
        .join(JoinType::InnerJoin, Relation::Material.def())
        .filter(material::Column::CutCollectionId.eq(collection_id))
        .filter(Column::UserId.eq(user_id))
        .order_by_asc(Column::CreatedAt)
        .all(db)
        .await?)
}

/// Returns one random snippet for the user (for the typing exercise).
pub async fn random_for_user(
    db: &DatabaseConnection,
    user_id: Uuid,
) -> Result<Option<snippet::Model>> {
    // PostgreSQL RANDOM() ordering — efficient enough for dev scale.
    Ok(Snippet::find()
        .filter(Column::UserId.eq(user_id))
        .order_by(Expr::cust("RANDOM()"), Order::Asc)
        .limit(1)
        .one(db)
        .await?)
}
