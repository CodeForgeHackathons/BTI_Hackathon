package models

type Walls struct {
	Project_id   int `gorm:"not null"`
	Start_x      string
	Start_y      string
	End_x        string
	End_y        string
	Load_bearing bool
	Thickness    string
}
