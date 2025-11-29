package models

type Constraints struct {
	Project_id      uint `gorm:"not null"`
	Forbidden_moves string
	Region_rules    string
}
