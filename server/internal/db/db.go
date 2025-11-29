package db

import (
	"ServerBTI/internal/models"
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDataBase() (*gorm.DB, error) {
	dsn := "host=localhost user=postgre password=12345 dbname=bti port=5432 sslmode=disable TimeZone=Europe/Moscow"
	//dsn := "host=localhost user=postgres password=qwerty dbname=postgres port=5432 sslmode=disable TimeZone=Europe/Moscow"
	db, err := gorm.Open(postgres.New(postgres.Config{DSN: dsn, PreferSimpleProtocol: true}), &gorm.Config{})

	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(&models.User{}, &models.PlanningProject{}, &models.Wall{},
		&models.Room{}, &models.Constraints{}, &models.RoomVertex{}); err != nil {
		return nil, err
	}
	fmt.Println("Database is connected!")
	return db, nil
}
