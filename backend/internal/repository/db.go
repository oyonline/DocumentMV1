package repository

import (
	"fmt"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// NewDB opens a database connection pool.
// driver must be "mysql" or "postgres".
func NewDB(driver, dsn string) (*sqlx.DB, error) {
	switch driver {
	case "mysql", "postgres":
		// ok
	default:
		return nil, fmt.Errorf("unsupported DB_DRIVER %q (want mysql or postgres)", driver)
	}

	db, err := sqlx.Connect(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("connecting to %s: %w", driver, err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	return db, nil
}
