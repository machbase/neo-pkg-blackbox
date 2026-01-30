package server

import (
	"fmt"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// GetCameras handles GET /api/cameras.
func (h *Handler) GetCameras(c *gin.Context) {
	ctx := c.Request.Context()

	var cameras []string

	metaRows, err := h.machbase.CameraMetadata(ctx)
	if err == nil && len(metaRows) > 0 {
		for _, row := range metaRows {
			if row.Name != "" {
				cameras = append(cameras, row.Name)
			}
		}
	}

	if len(cameras) == 0 {
		tags, err := h.machbase.ListTags(ctx)
		if err != nil {
			h.sendError(c, http.StatusInternalServerError, "Failed to list cameras")
			return
		}
		for _, tag := range tags {
			stats, err := h.machbase.BlackboxStatsByTag(ctx, tag)
			if err == nil && stats != nil {
				cameras = append(cameras, tag)
			}
		}
	}

	if len(cameras) == 0 {
		h.sendError(c, http.StatusNotFound, "No cameras available")
		return
	}

	cameras = uniqueStrings(cameras)
	sort.Strings(cameras)

	resp := GetCamerasResponse{
		Cameras: make([]Camera, len(cameras)),
	}
	for i, cam := range cameras {
		resp.Cameras[i] = Camera{ID: cam, Label: cam}
	}

	c.JSON(http.StatusOK, resp)
}

// GetTimeRange handles GET /api/get_time_range.
func (h *Handler) GetTimeRange(c *gin.Context) {
	var req GetTimeRangeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "Missing required parameter 'tagname'")
		return
	}

	camera, err := sanitizeTag(req.Tagname)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, err.Error())
		return
	}

	ctx := c.Request.Context()
	var start, end *string

	stats, err := h.machbase.BlackboxStatsByTag(ctx, camera)
	if err == nil && stats != nil {
		minStr := formatTime(stats.MinTime)
		maxStr := formatTime(stats.MaxTime)
		start = &minStr
		end = &maxStr
	}

	if start == nil || end == nil {
		bounds, err := h.machbase.BlackboxTimeBounds(ctx, camera)
		if err == nil && bounds != nil {
			if start == nil {
				minStr := formatTime(bounds.MinTime)
				start = &minStr
			}
			if end == nil {
				maxStr := formatTime(bounds.MaxTime)
				end = &maxStr
			}
		}
	}

	if start == nil || end == nil {
		h.sendError(c, http.StatusNotFound, fmt.Sprintf("No timeline entries for camera '%s'", camera))
		return
	}

	chunkDuration := 0.0
	interval, err := h.machbase.BlackboxChunkInterval(ctx, camera)
	if err == nil && interval > 0 {
		chunkDuration = interval
	}

	fps := h.getCameraFPS(c, camera)
	if chunkDuration == 0 && fps != nil && *fps > 0 {
		chunkDuration = 1.0 / float64(*fps)
	}

	if chunkDuration == 0 {
		chunkDuration = 5.0
	}

	resp := GetTimeRangeResponse{
		Camera:               camera,
		Start:                *start,
		End:                  *end,
		ChunkDurationSeconds: chunkDuration,
		FPS:                  fps,
	}

	c.JSON(http.StatusOK, resp)
}

// GetChunkInfo handles GET /api/get_chunk_info.
func (h *Handler) GetChunkInfo(c *gin.Context) {
	var req GetChunkInfoRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "Missing required parameter 'tagname' or 'time'")
		return
	}

	camera, err := sanitizeTag(req.Tagname)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, err.Error())
		return
	}

	timestamp, err := parseTimeToken(req.Time)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, err.Error())
		return
	}

	ctx := c.Request.Context()
	record, err := h.machbase.ChunkRecordForTime(ctx, camera, timestamp)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "Failed to fetch chunk info")
		return
	}

	if record == nil {
		h.sendError(c, http.StatusNotFound, fmt.Sprintf("Chunk not found for camera '%s' at time '%s'", camera, req.Time))
		return
	}

	resp := GetChunkInfoResponse{
		Camera: camera,
		Time:   formatTime(record.EntryTime),
		Length: record.Length,
	}

	if record.Value != 0 {
		resp.Sign = &record.Value
	}

	c.JSON(http.StatusOK, resp)
}

// GetChunk handles GET /api/v_get_chunk.
func (h *Handler) GetChunk(c *gin.Context) {
	var req GetChunkRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "Missing required parameter 'tagname'")
		return
	}

	camera, err := sanitizeTag(req.Tagname)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, err.Error())
		return
	}

	timeToken := req.Time
	if timeToken == "" {
		timeToken = "0"
	}

	var data []byte

	if timeToken == "0" || strings.ToLower(timeToken) == "init" {
		path := h.initPath(camera)
		data, err = os.ReadFile(path)
		if err != nil {
			h.sendError(c, http.StatusNotFound, fmt.Sprintf("Segment not found for camera '%s'", camera))
			return
		}
	} else {
		timestamp, err := parseTimeToken(timeToken)
		if err != nil {
			h.sendError(c, http.StatusBadRequest, err.Error())
			return
		}

		ctx := c.Request.Context()
		record, err := h.machbase.ChunkRecordForTime(ctx, camera, timestamp)
		if err != nil {
			h.sendError(c, http.StatusInternalServerError, "Failed to fetch chunk info")
			return
		}

		if record == nil {
			h.sendError(c, http.StatusNotFound, fmt.Sprintf("Chunk not found for camera '%s' at time '%s'", camera, timeToken))
			return
		}

		path := h.chunkPath(c, camera, record.Value)
		data, err = os.ReadFile(path)
		if err != nil {
			h.sendError(c, http.StatusNotFound, fmt.Sprintf("Segment not found for camera '%s'", camera))
			return
		}
	}

	c.Data(http.StatusOK, "application/octet-stream", data)
}

// GetCameraRollup handles GET /api/get_camera_rollup_info.
func (h *Handler) GetCameraRollup(c *gin.Context) {
	var req GetCameraRollupRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		h.sendError(c, http.StatusBadRequest, "Missing required parameters")
		return
	}

	camera, err := sanitizeTag(req.Tagname)
	if err != nil {
		h.sendError(c, http.StatusBadRequest, err.Error())
		return
	}

	minutes := req.Minutes
	if minutes <= 0 {
		minutes = 1
	}

	if req.StartTime < 0 || req.EndTime < 0 {
		h.sendError(c, http.StatusBadRequest, "Start and end time must be non-negative")
		return
	}

	if req.StartTime >= req.EndTime {
		h.sendError(c, http.StatusBadRequest, "Parameter 'start_time' must be earlier than 'end_time'")
		return
	}

	ctx := c.Request.Context()
	rows, err := h.machbase.CameraRollup(ctx, camera, minutes, req.StartTime, req.EndTime)
	if err != nil {
		h.sendError(c, http.StatusInternalServerError, "Failed to fetch rollup data")
		return
	}

	rollupRows := make([]RollupRow, len(rows))
	for i, row := range rows {
		rollupRows[i] = RollupRow{
			Time: formatTime(row.Time),
		}
		if row.SumLength != 0 {
			sum := row.SumLength
			rollupRows[i].SumLength = &sum
		}
	}

	startDt := utcNanosecondsToTime(req.StartTime)
	endDt := utcNanosecondsToTime(req.EndTime)

	resp := GetCameraRollupResponse{
		Camera:      camera,
		Minutes:     minutes,
		StartTimeNs: req.StartTime,
		EndTimeNs:   req.EndTime,
		Start:       formatTime(startDt),
		End:         formatTime(endDt),
		Rows:        rollupRows,
	}

	c.JSON(http.StatusOK, resp)
}

// utcNanosecondsToTime converts UTC nanoseconds to time.Time.
func utcNanosecondsToTime(ns int64) time.Time {
	sec := ns / 1_000_000_000
	nsec := ns % 1_000_000_000
	return time.Unix(sec, nsec).Local()
}
