package admin

import (
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func setupRedeemExportRouter() (*gin.Engine, *stubAdminService) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	adminSvc := newStubAdminService()

	h := NewRedeemHandler(adminSvc, nil)
	router.GET("/api/v1/admin/redeem-codes/export", h.Export)
	return router, adminSvc
}

func TestRedeemExportPassesSearchAndSort(t *testing.T) {
	router, adminSvc := setupRedeemExportRouter()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/redeem-codes/export?type=balance&status=unused&search=ABC&sort_by=value&sort_order=asc", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	require.Equal(t, 1, adminSvc.lastListRedeemCodes.calls)
	require.Equal(t, "balance", adminSvc.lastListRedeemCodes.codeType)
	require.Equal(t, "unused", adminSvc.lastListRedeemCodes.status)
	require.Equal(t, "ABC", adminSvc.lastListRedeemCodes.search)
	require.Equal(t, "value", adminSvc.lastListRedeemCodes.sortBy)
	require.Equal(t, "asc", adminSvc.lastListRedeemCodes.sortOrder)
}

func TestRedeemExportSortDefaults(t *testing.T) {
	router, adminSvc := setupRedeemExportRouter()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/redeem-codes/export", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	require.Equal(t, 1, adminSvc.lastListRedeemCodes.calls)
	require.Equal(t, "id", adminSvc.lastListRedeemCodes.sortBy)
	require.Equal(t, "desc", adminSvc.lastListRedeemCodes.sortOrder)
}

func TestRedeemExportAddsMYRUnitWithoutChangingExistingColumns(t *testing.T) {
	router, adminSvc := setupRedeemExportRouter()
	adminSvc.redeems = []service.RedeemCode{
		{ID: 1, Code: "BALANCE", Type: "balance", Value: 10, Status: "unused", CreatedAt: time.Unix(1, 0).UTC()},
		{ID: 2, Code: "TRIAL", Type: "trial", Value: 3, Status: "unused", CreatedAt: time.Unix(2, 0).UTC()},
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/redeem-codes/export", nil)
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	rows, err := csv.NewReader(strings.NewReader(rec.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Equal(t, []string{"id", "code", "type", "value", "status", "used_by", "used_by_email", "used_at", "expires_at", "created_at", "value_unit"}, rows[0])
	require.Equal(t, "BALANCE", rows[1][1])
	require.Equal(t, "10.00", rows[1][3])
	require.Equal(t, "MYR", rows[1][10])
	require.Equal(t, "TRIAL", rows[2][1])
	require.Equal(t, "", rows[2][10])
}
