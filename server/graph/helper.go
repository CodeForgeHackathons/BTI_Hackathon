package graph

import (
    "ServerBTI/graph/model"
    "ServerBTI/internal/models"
    "fmt"
    "strconv"
    "time"
)

func atofPtr(s *string) float64 {
	if s == nil {
		return 0
	}
	v, err := strconv.ParseFloat(*s, 64)
	if err != nil {
		return 0
	}
	return v
}

func ConvertDbProjectToGraph(p *models.PlanningProject) *model.PlanningProject {
    var clientTs *string
    if p.ClientTimestamp != "" {
        clientTs = &p.ClientTimestamp
    }
    var planFile *model.PlanFile
    if p.PlanFileName != "" {
        planFile = &model.PlanFile{
            Name:    p.PlanFileName,
            Size:    atofPtr(&p.PlanFileSize),
            Type:    p.PlanFileType,
            Content: p.PlanFileContent,
        }
    }

    rooms := make([]*model.Room, 0, len(p.Rooms))
    for i := range p.Rooms {
        rv := make([]*model.Vertex, 0, len(p.Rooms[i].Vertices))
        for j := range p.Rooms[i].Vertices {
            rv = append(rv, &model.Vertex{X: atofPtr(&p.Rooms[i].Vertices[j].X), Y: atofPtr(&p.Rooms[i].Vertices[j].Y)})
        }
        rooms = append(rooms, &model.Room{
            ID:       fmt.Sprintf("%d", p.Rooms[i].ID),
            Name:     p.Rooms[i].Name,
            Height:   atofPtr(&p.Rooms[i].Height),
            Vertices: rv,
        })
    }

    walls := make([]*model.Wall, 0, len(p.Walls))
    for i := range p.Walls {
        wt := p.Walls[i].WallType
        walls = append(walls, &model.Wall{
            ID:          fmt.Sprintf("%d", p.Walls[i].ID),
            Start:       &model.WallEnd{X: atofPtr(&p.Walls[i].StartX), Y: atofPtr(&p.Walls[i].StartY)},
            End:         &model.WallEnd{X: atofPtr(&p.Walls[i].EndX), Y: atofPtr(&p.Walls[i].EndY)},
            LoadBearing: p.Walls[i].LoadBearing,
            Thickness:   atofPtr(&p.Walls[i].Thickness),
            WallType:    func() *string { if wt == "" { return nil }; return &wt }(),
        })
    }

    var constraints *model.Constraints
    if len(p.Constraints) > 0 {
        cm := p.Constraints[0]
        var fm []string
        var rr []string
        if cm.ForbiddenMoves != "" { fm = splitComma(cm.ForbiddenMoves) }
        if cm.RegionRules != "" { rr = splitComma(cm.RegionRules) }
        constraints = &model.Constraints{ForbiddenMoves: fm, RegionRules: rr}
    }

    return &model.PlanningProject{
        ID:              fmt.Sprintf("%d", p.ID),
        Status:          p.Status,
        CreatedAt:       p.Created_at.Format(time.RFC3339),
        ClientTimestamp: clientTs,
        Plan: &model.Plan{
            Address:           p.Address,
            Area:              atofPtr(&p.Area),
            Source:            p.Source,
            LayoutType:        p.LayoutType,
            FamilyProfile:     p.FamilyProfile,
            Goal:              p.Goal,
            Prompt:            p.Prompt,
            CeilingHeight:     atofPtr(&p.CeilingHeight),
            FloorDelta:        atofPtr(&p.FloorDelta),
            RecognitionStatus: p.RecognitionStatus,
            File:              planFile,
        },
        Geometry:    &model.Geometry{Rooms: rooms},
        Walls:       walls,
        Constraints: constraints,
    }
}

func splitComma(s string) []string {
    out := []string{}
    cur := ""
    for i := 0; i < len(s); i++ {
        if s[i] == ',' {
            if cur != "" { out = append(out, cur) }
            cur = ""
        } else {
            cur += string(s[i])
        }
    }
    if cur != "" { out = append(out, cur) }
    for i := range out { out[i] = trimSpace(out[i]) }
    return out
}

func trimSpace(s string) string {
    i := 0
    j := len(s)
    for i < j && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r') { i++ }
    for j > i && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\n' || s[j-1] == '\r') { j-- }
    return s[i:j]
}
