package models

type Rooms struct {
	Project_id uint `gorm:"not null"`
	Name       string
	Height     string
}
