use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "snippets")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub material_id: Uuid,
    pub user_id: Uuid,
    pub text: String,
    pub word_count: i32,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::material::Entity",
        from = "Column::MaterialId",
        to = "super::material::Column::Id"
    )]
    Material,
}

impl Related<super::material::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Material.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
