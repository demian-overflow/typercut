pub mod cut_collections;
pub mod materials;
pub mod sessions;
pub mod snippets;
pub mod users;

use anyhow::Result;
use sea_orm::{Database, DatabaseConnection};
use sea_orm::SqlxPostgresConnector;

/// Connect to Postgres, run raw-SQL migrations, then return a SeaORM connection.
pub async fn connect_and_migrate(database_url: &str) -> Result<DatabaseConnection> {
    // 1. Build a plain sqlx pool so we can run migrate!
    let sqlx_pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(10)
        .connect(database_url)
        .await?;

    // 2. Run raw SQL migration files from ./migrations/
    sqlx::migrate!("./migrations").run(&sqlx_pool).await?;

    // 3. Hand the pool to SeaORM — no second connection needed.
    let db = SqlxPostgresConnector::from_sqlx_postgres_pool(sqlx_pool);
    Ok(db)
}

/// Thin wrapper used in tests where you already have a live connection.
pub async fn connect(database_url: &str) -> Result<DatabaseConnection> {
    Ok(Database::connect(database_url).await?)
}
