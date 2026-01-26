package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) handleSensors(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("tagname"))
	if raw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'tagname'"))
		return
	}
	camera, err := sanitizeTag(raw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	sensors, err := s.data.listSensorTags(c.Request.Context(), camera)
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"camera": camera, "sensors": sensors})
}

func (s *Server) handleSensorData(c *gin.Context) {
	sensorParam := strings.TrimSpace(c.Query("sensors"))
	if sensorParam == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'sensors'"))
		return
	}

	parts := strings.Split(sensorParam, ",")
	var sensorIDs []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		id, err := sanitizeTag(p)
		if err != nil {
			s.writeError(c, newApiError(400, err.Error()))
			return
		}
		sensorIDs = append(sensorIDs, id)
	}
	if len(sensorIDs) == 0 {
		s.writeError(c, newApiError(400, "Parameter 'sensors' must include at least one sensor id"))
		return
	}

	startRaw := strings.TrimSpace(c.Query("start"))
	endRaw := strings.TrimSpace(c.Query("end"))
	if startRaw == "" || endRaw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'start' or 'end'"))
		return
	}

	startT, err := parseTimeToken(startRaw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}
	endT, err := parseTimeToken(endRaw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	samples, err := s.data.sensorData(c.Request.Context(), sensorIDs, startT, endT)
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"sensors": sensorIDs, "samples": samples})
}
