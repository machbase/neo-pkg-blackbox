package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type CameraRequest struct {
	Table string `json:"table"`
	Name  string `json:"name"`
	Desc  string `json:"desc"`

	RtspURL   string `json:"rtsp_url"`
	WebRTCUrl string `json:"webrtc_url"`

	FFmpegOption string `json:"ffmpeg_option"` // 프론트에 전달 필요
}

// CreateCamera handles POST /api/camera.
// Creates a new camera with TABLE_NM, RTSP URL, webRTC URL, name, description, ffmpeg cfg.
func (h *Handler) CreateCamera(c *gin.Context) {
	// TODO: implement
	c.JSON(http.StatusNotImplemented, gin.H{"error": "not implemented"})
}

type CameraInfoResponse struct {
	Table string `json:"table"`
	Name  string `json:"name"`
	Desc  string `json:"desc"`

	RtspURL   string `json:"rtsp_url"`
	WebRTCUrl string `json:"webrtc_url"`

	FFmpegOption string `json:"ffmpeg_option"` // 프론트에 전달 필요
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
