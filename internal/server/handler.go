package server

import (
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"blackbox-backend/internal/db"

	"github.com/gin-gonic/gin"
)

const videoStreamIndex = 0

var defaultSensorNames = []string{
	"sensor-1", "sensor-2", "sensor-3", "sensor-4", "sensor-5",
	"sensor-6", "sensor-7", "sensor-8", "sensor-9", "sensor-10",
}

var defaultSensorLabels = map[string]string{
	"sensor-1":  "Sensor 1",
	"sensor-2":  "Sensor 2",
	"sensor-3":  "Sensor 3",
	"sensor-4":  "Sensor 4",
	"sensor-5":  "Sensor 5",
	"sensor-6":  "Sensor 6",
	"sensor-7":  "Sensor 7",
	"sensor-8":  "Sensor 8",
	"sensor-9":  "Sensor 9",
	"sensor-10": "Sensor 10",
}

var tagPattern = regexp.MustCompile(`^[A-Za-z0-9_.:-]+$`)

// Handler handles API requests.
type Handler struct {
	machbase    *db.Machbase
	dataPath    string
	mvsDir      string
	prefixCache map[string]string
	fpsCache    map[string]*int
	cacheMu     sync.RWMutex
}

// NewHandler creates a new Handler.
func NewHandler(machbase *db.Machbase, dataPath, mvsDir string) *Handler {
	if dataPath == "" {
		dataPath = "/data"
	}
	return &Handler{
		machbase:    machbase,
		dataPath:    dataPath,
		mvsDir:      mvsDir,
		prefixCache: make(map[string]string),
		fpsCache:    make(map[string]*int),
	}
}

// sendError sends an error response.
func (h *Handler) sendError(c *gin.Context, status int, message string) {
	c.JSON(status, ErrorResponse{Error: message})
}

// sanitizeTag validates and sanitizes a tag value.
func sanitizeTag(value string) (string, error) {
	if value == "" {
		return "", ErrEmptyTag
	}
	if !tagPattern.MatchString(value) {
		return "", ErrIllegalTagCharacters
	}
	return value, nil
}

// parseTimeToken parses a time token string.
func parseTimeToken(raw string) (time.Time, error) {
	candidate := strings.TrimSpace(raw)
	if strings.ToLower(candidate) == "now" {
		return time.Now(), nil
	}

	normalized := strings.ReplaceAll(candidate, "T", " ")
	normalized = strings.TrimSuffix(normalized, "Z")

	layouts := []string{
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}

	for _, layout := range layouts {
		if t, err := time.ParseInLocation(layout, normalized, time.Local); err == nil {
			return t, nil
		}
	}

	return time.Time{}, ErrInvalidTimeFormat
}

// formatTime formats a time value for response.
func formatTime(t time.Time) string {
	s := t.Local().Format("2006-01-02T15:04:05.000000")
	if idx := strings.Index(s, "."); idx != -1 {
		s = strings.TrimRight(s, "0")
		s = strings.TrimRight(s, ".")
	}
	return s
}

// resolvePrefix resolves the chunk prefix for a camera.
func (h *Handler) resolvePrefix(c *gin.Context, camera string) string {
	h.cacheMu.RLock()
	if prefix, ok := h.prefixCache[camera]; ok {
		h.cacheMu.RUnlock()
		return prefix
	}
	h.cacheMu.RUnlock()

	meta, err := h.machbase.Metadata(c.Request.Context(), camera)
	if err != nil || meta == nil {
		h.cacheMu.Lock()
		h.prefixCache[camera] = "chunk-stream"
		h.cacheMu.Unlock()
		return "chunk-stream"
	}

	h.cacheMu.Lock()
	h.prefixCache[camera] = meta.Prefix
	h.fpsCache[camera] = meta.FPS
	h.cacheMu.Unlock()

	if meta.Prefix == "" {
		return "chunk-stream"
	}
	return meta.Prefix
}

// getCameraFPS gets the FPS for a camera.
func (h *Handler) getCameraFPS(c *gin.Context, camera string) *int {
	h.cacheMu.RLock()
	if fps, ok := h.fpsCache[camera]; ok {
		h.cacheMu.RUnlock()
		return fps
	}
	h.cacheMu.RUnlock()

	h.resolvePrefix(c, camera)

	h.cacheMu.RLock()
	defer h.cacheMu.RUnlock()
	return h.fpsCache[camera]
}

// initPath returns the path to the init segment.
func (h *Handler) initPath(camera string) string {
	return filepath.Join(h.dataPath, camera, "init-stream0.m4s")
}

// chunkPath returns the path to a chunk segment.
func (h *Handler) chunkPath(c *gin.Context, camera string, chunkNumber int64) string {
	prefix := h.resolvePrefix(c, camera)
	t := time.UnixMilli(chunkNumber).UTC()
	dateDir := t.Format("20060102")
	filename := prefix + "0-" + time.UnixMilli(chunkNumber).UTC().Format("20060102150405") + ".m4s"
	return filepath.Join(h.dataPath, camera, dateDir, filename)
}

// readChunkFile reads a chunk file.
func (h *Handler) readChunkFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// sensorSortKey returns a sort key for sensor IDs.
func sensorSortKey(sensorID string) (int, int, string) {
	re := regexp.MustCompile(`^sensor-(\d+)$`)
	if matches := re.FindStringSubmatch(sensorID); len(matches) == 2 {
		var num int
		_, _ = parseIntValue(matches[1], &num)
		return 0, num, ""
	}
	return 1, 0, sensorID
}

// sortSensorIDs sorts sensor IDs.
func sortSensorIDs(sensorIDs []string) {
	sort.Slice(sensorIDs, func(i, j int) bool {
		a1, a2, a3 := sensorSortKey(sensorIDs[i])
		b1, b2, b3 := sensorSortKey(sensorIDs[j])
		if a1 != b1 {
			return a1 < b1
		}
		if a2 != b2 {
			return a2 < b2
		}
		return a3 < b3
	})
}

func parseIntValue(s string, out *int) (bool, error) {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false, nil
		}
	}
	var val int
	for _, c := range s {
		val = val*10 + int(c-'0')
	}
	*out = val
	return true, nil
}

// sensorKeyFromTag extracts sensor key from tag.
func sensorKeyFromTag(camera, tag string) string {
	if tag == "" {
		return ""
	}
	prefix1 := camera + ":"
	prefix2 := camera + "."
	if strings.HasPrefix(tag, prefix1) {
		return tag[len(prefix1):]
	}
	if strings.HasPrefix(tag, prefix2) {
		return tag[len(prefix2):]
	}
	return tag
}

// matchSensorID matches a tag name to a sensor ID.
func matchSensorID(tagName string, sensorIDs []string) string {
	for _, sensorID := range sensorIDs {
		if tagName == sensorID {
			return sensorID
		}
		if strings.HasSuffix(tagName, ":"+sensorID) || strings.HasSuffix(tagName, "."+sensorID) {
			return sensorID
		}
	}
	return ""
}

// uniqueStrings returns unique strings from a slice.
func uniqueStrings(ss []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

// Error types
type ApiError struct {
	Status  int
	Message string
}

func (e ApiError) Error() string {
	return e.Message
}

func NewApiError(status int, message string) ApiError {
	return ApiError{Status: status, Message: message}
}

var (
	ErrEmptyTag             = NewApiError(http.StatusBadRequest, "Empty tag value")
	ErrIllegalTagCharacters = NewApiError(http.StatusBadRequest, "Illegal characters in tag")
	ErrInvalidTimeFormat    = NewApiError(http.StatusBadRequest, "Invalid time format")
)
