package models

import (
	"time"
)

type User struct {
	ID       int64 `gorm:"primaryKey"`
	Login    string
	Password string
	Username string
	Email    *string
	Birthday *time.Time
}
