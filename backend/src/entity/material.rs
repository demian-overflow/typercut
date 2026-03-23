use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "materials")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    pub cut_collection_id: Option<Uuid>,
    pub title: String,
    pub content: String,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::snippet::Entity")]
    Snippet,
    #[sea_orm(
        belongs_to = "super::cut_collection::Entity",
        from = "Column::CutCollectionId",
        to = "super::cut_collection::Column::Id"
    )]
    CutCollection,
}

impl Related<super::snippet::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Snippet.def()
    }
}

impl Related<super::cut_collection::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::CutCollection.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
