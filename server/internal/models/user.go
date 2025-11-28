package models

import (
	"time"
)

type User struct {
	ID       uint   `gorm:"primaryKey"`
	Login    string `gorm:"not null"`
	Password string `gorm:"not null"`
	Username string
	Email    string
	Birthday time.Time
}
