use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    pub snippet_id: Option<Uuid>,
    pub text: String,
    pub source: String,
    pub status: String,
    pub wpm: Option<Decimal>,
    pub accuracy: Option<Decimal>,
    pub duration_seconds: Option<Decimal>,
    pub total_keystrokes: Option<i32>,
    pub correct_keystrokes: Option<i32>,
    pub started_at: DateTimeWithTimeZone,
    pub completed_at: Option<DateTimeWithTimeZone>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::user::Entity",
        from = "Column::UserId",
        to = "super::user::Column::Id"
    )]
    User,
    #[sea_orm(
        belongs_to = "super::snippet::Entity",
        from = "Column::SnippetId",
        to = "super::snippet::Column::Id"
    )]
    Snippet,
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl Related<super::snippet::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Snippet.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
