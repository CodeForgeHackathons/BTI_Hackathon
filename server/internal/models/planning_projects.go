package models

import (
	"time"
)

type Planning_projects struct {
	ID                 uint `gorm:"primaryKey"`
	User_id            uint `gorm:"not null"`
	Status             string
	Created_at         time.Time
	Address            string
	Area               string
	Source             string
	Layout_type        string
	Family_profile     string
	Goal               string
	Prompt             string
	Ceiling_height     string
	Floor_delta        string
	Recognition_status string
}
