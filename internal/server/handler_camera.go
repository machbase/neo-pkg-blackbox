package server

import (
	"blackbox-backend/internal/db"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
)

type CameraCreateRequest struct {
	Table string `json:"table" binding:"required"`
	Name  string `json:"name" binding:"required"`
	Desc  string `json:"desc"`

	RtspURL   string `json:"rtsp_url"` // binding:"url" 어떤 url
	WebRTCURL string `json:"webrtc_url"`
	MediaURL  string `json:"media_url"` // 미디어 서버 URL

	EventRule     string   `json:"event_rule"`     // 조건식
	DetectObjects []string `json:"detect_objects"` // ex) ["person", "car", "truck", "bus"]

	FFmpegOptions []ReqKV `json:"ffmpeg_options"` // 프론트에 전달 필요
}
type ReqKV struct {
	K string  `json:"k" binding:"required"`
	V *string `json:"v"`
}

func toCameraRow(req CameraCreateRequest) (db.CameraRow, error) {
	optsJSON, err := json.Marshal(req.FFmpegOptions)
	if err != nil {
		return db.CameraRow{}, err
	}

	detectJSON, err := json.Marshal(req.DetectObjects)
	if err != nil {
		return db.CameraRow{}, err
	}

	return db.CameraRow{
		Table:         req.Table,
		Name:          req.Name,
		Desc:          req.Desc,
		RtspURL:       req.RtspURL,
		WebRTCURL:     req.WebRTCURL,
		MediaURL:      req.MediaURL,
		EventRule:     req.EventRule,
		DetectObjects: string(detectJSON),
		FFmpegJSON:    string(optsJSON),
	}, nil
}

// CreateCamera handles POST /api/camera.
// Creates a new camera with TABLE_NM, RTSP URL, webRTC URL, name, description, ffmpeg cfg.
func (h *Handler) CreateCamera(c *gin.Context) {
	tick := time.Now()

	var req CameraCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Reason:  "bad request parameter",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	row, err := toCameraRow(req)
	if err != nil {
		// log
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Reason:  "bad ffmpeg options",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	if err := h.machbase.InsertCamera(c.Request.Context(), row); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Reason:  "bad insert camera",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Reason:  "success",
		Elapse:  time.Since(tick).String(),
		Data:    nil,
	})
}

type CameraInfoResponse struct {
	Table string `json:"table"`
	Name  string `json:"name"`
	Desc  string `json:"desc"`

	RtspURL   string `json:"rtsp_url"`
	WebRTCUrl string `json:"webrtc_url"`
	MediaURL  string `json:"media_url"`

	EventRule     string `json:"event_rule"`
	DetectObjects string `json:"detect_objects"`
	FFmpegOption  string `json:"ffmpeg_option"`
}

// ============================================================
// MVS (Machine Vision System) Camera
// ============================================================

type MvsCameraCreateRequest struct {
	CameraID      string   `json:"camera_id"`                         // cam{id}_{model_id}_{time} (자동 생성 가능)
	CameraURL     string   `json:"camera_url" binding:"required"`     // rtsp URL
	ModelID       int      `json:"model_id"`                          // 기본 모델 0
	DetectObjects []string `json:"detect_objects" binding:"required"` // ex) ["person", "car", "truck", "bus"]
}

// CreateMvsCamera handles POST /api/mvs/camera.
// MVS 파일 저장용 - camera_id, camera_url, model_id, detect_objects만 저장.
func (h *Handler) CreateMvsCamera(c *gin.Context) {
	tick := time.Now()

	var req MvsCameraCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Reason:  "bad request parameter",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	// camera_id 자동 생성: cam{id}_{model_id}_{unix_time}
	if req.CameraID == "" {
		req.CameraID = fmt.Sprintf("cam%d_%d_%d", time.Now().UnixNano()%100000, req.ModelID, time.Now().Unix())
	}

	// .mvs 파일로 저장
	mvsData := map[string]any{
		"camera_id":      req.CameraID,
		"camera_url":     req.CameraURL,
		"model_id":       req.ModelID,
		"detect_objects":  req.DetectObjects,
	}

	mvsJSON, err := json.MarshalIndent(mvsData, "", "  ")
	if err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Reason:  "failed to marshal mvs data",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	if err := os.MkdirAll(h.mvsDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Reason:  "failed to create mvs directory",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	mvsFileName := fmt.Sprintf("%s_%d_%d.mvs", req.CameraID, req.ModelID, time.Now().Unix())
	mvsPath := filepath.Join(h.mvsDir, mvsFileName)
	if err := os.WriteFile(mvsPath, mvsJSON, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Reason:  "failed to write mvs file",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Reason:  "success",
		Elapse:  time.Since(tick).String(),
		Data: gin.H{
			"camera_id": req.CameraID,
			"mvs_path":  mvsPath,
		},
	})
}

// ============================================================
// MVS Event (외부 프로그램 → detection 결과 수신)
// ============================================================

type MvsEventRequest struct {
	Table        string             `json:"table" binding:"required"`        // {camera}_log 테이블명
	CameraID     string             `json:"camera_id" binding:"required"`
	ModelID      string             `json:"model_id"`
	Timestamp    string             `json:"timestamp" binding:"required"`    // "2026-02-02 15:30:45.123"
	Detections   map[string]float64 `json:"detections" binding:"required"`   // {"person": 3, "car": 5, ...}
	TotalObjects int                `json:"total_objects"`
}

// CreateMvsEvent handles POST /api/mvs/event.
// 외부 프로그램에서 detection 결과를 수신하여 {camera}_log 테이블에 저장.
func (h *Handler) CreateMvsEvent(c *gin.Context) {
	tick := time.Now()

	var req MvsEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Reason:  "bad request parameter",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	// timestamp 파싱 → nanoseconds
	ts, err := time.ParseInLocation("2006-01-02 15:04:05.999", req.Timestamp, time.Local)
	if err != nil {
		c.JSON(http.StatusBadRequest, Response{
			Success: false,
			Reason:  "bad timestamp format, expected: 2006-01-02 15:04:05.123",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}
	tsNano := ts.UnixNano()

	// detections → CameraLogRow 변환
	logs := make([]db.CameraLogRow, 0, len(req.Detections))
	for ident, value := range req.Detections {
		logs = append(logs, db.CameraLogRow{
			Name:     req.CameraID + "." + ident,
			Time:     tsNano,
			Value:    value,
			ModelID:  req.ModelID,
			CameraID: req.CameraID,
			Ident:    ident,
		})
	}

	if err := h.machbase.InsertCameraLogs(c.Request.Context(), req.Table, logs); err != nil {
		c.JSON(http.StatusInternalServerError, Response{
			Success: false,
			Reason:  "failed to insert camera logs",
			Elapse:  time.Since(tick).String(),
			Data:    nil,
		})
		return
	}

	c.JSON(http.StatusOK, Response{
		Success: true,
		Reason:  "success",
		Elapse:  time.Since(tick).String(),
		Data: gin.H{
			"camera_id": req.CameraID,
			"count":     len(logs),
		},
	})
}

// GetCamera handles GET /api/camera/:id.
// Returns camera detail information.
func (h *Handler) GetCamera(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// UpdateCamera handles POST /api/camera/:id.
// Updates camera settings (RTSP URL, webRTC URL, ffmpeg cfg).
func (h *Handler) UpdateCamera(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// DeleteCamera handles DELETE /api/camera/:id.
// Deletes a camera.
func (h *Handler) DeleteCamera(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// TestCameraConnection handles POST /api/camera/test.
// Tests RTSP URL connection.
func (h *Handler) TestCameraConnection(c *gin.Context) {
	// TODO: implement
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// EnableCamera handles POST /api/camera/:id/enable.
// Enables the camera.
func (h *Handler) EnableCamera(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// DisableCamera handles POST /api/camera/:id/disable.
// Disables the camera.
func (h *Handler) DisableCamera(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// GetCameraStatus handles GET /api/camera/:id/status.
// Returns real-time status of a camera.
func (h *Handler) GetCameraStatus(c *gin.Context) {
	// TODO: implement
	_ = c.Param("id")
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

// GetCamerasHealth handles GET /api/cameras/health.
// Returns health summary of all cameras.
func (h *Handler) GetCamerasHealth(c *gin.Context) {
	// TODO: implement
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}
