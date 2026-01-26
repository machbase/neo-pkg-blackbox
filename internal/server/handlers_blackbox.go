package server

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func (s *Server) handleCameras(c *gin.Context) {
	out, err := s.data.listCameras(c.Request.Context())
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"cameras": out})
}

func (s *Server) handleTimeRange(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("tagname"))
	if raw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'tagname'"))
		return
	}
	tag, err := sanitizeTag(raw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}
	out, err := s.data.timeRange(c.Request.Context(), tag)
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

func (s *Server) handleChunkInfo(c *gin.Context) {
	tagRaw := strings.TrimSpace(c.Query("tagname"))
	if tagRaw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'tagname'"))
		return
	}
	camera, err := sanitizeTag(tagRaw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	timeToken := strings.TrimSpace(c.Query("time"))
	if timeToken == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'time'"))
		return
	}

	ts, err := parseTimeToken(timeToken)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	chunk, entryT, lengthVal, ok, err := s.data.chunkRecordForTime(c.Request.Context(), camera, ts, timeToken)
	if err != nil {
		s.writeError(c, err)
		return
	}
	if !ok {
		s.writeError(c, newApiError(404, fmt.Sprintf("Chunk not found for camera '%s' at time '%s'", camera, timeToken)))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"camera": camera,
		"time":   formatLocalTime(entryT),
		"length": lengthVal,
		"sign":   chunk,
	})
}

func (s *Server) handleGetChunk(c *gin.Context) {
	tagRaw := strings.TrimSpace(c.Query("tagname"))
	if tagRaw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'tagname'"))
		return
	}
	camera, err := sanitizeTag(tagRaw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	timeToken := c.DefaultQuery("time", "0")
	payload, err := s.data.frameBytes(c.Request.Context(), camera, timeToken)
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/octet-stream", payload)
}

func (s *Server) handleCameraRollup(c *gin.Context) {
	tagRaw := strings.TrimSpace(c.Query("tagname"))
	if tagRaw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'tagname'"))
		return
	}
	camera, err := sanitizeTag(tagRaw)
	if err != nil {
		s.writeError(c, newApiError(400, err.Error()))
		return
	}

	minutesRaw := c.DefaultQuery("minutes", "1")
	minutes, err := strconv.Atoi(minutesRaw)
	if err != nil {
		s.writeError(c, newApiError(400, "Parameter 'minutes' must be an integer"))
		return
	}

	startRaw := strings.TrimSpace(c.Query("start_time"))
	endRaw := strings.TrimSpace(c.Query("end_time"))
	if startRaw == "" || endRaw == "" {
		s.writeError(c, newApiError(400, "Missing required parameter 'start_time' or 'end_time'"))
		return
	}

	startNS, err := strconv.ParseInt(startRaw, 10, 64)
	if err != nil {
		s.writeError(c, newApiError(400, "Parameters 'start_time' and 'end_time' must be integers (UTC nanoseconds)"))
		return
	}
	endNS, err := strconv.ParseInt(endRaw, 10, 64)
	if err != nil {
		s.writeError(c, newApiError(400, "Parameters 'start_time' and 'end_time' must be integers (UTC nanoseconds)"))
		return
	}

	out, err := s.data.cameraRollup(c.Request.Context(), camera, minutes, startNS, endNS)
	if err != nil {
		s.writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}
