package models

type User struct {
	ID       uint   `gorm:"primaryKey"`
	Login    string `gorm:"not null"`
	Password string `gorm:"not null"`
	Username string
	Wallet   int
	Role     string
	Email    string
	Birthday string
}
