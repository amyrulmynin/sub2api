package handler

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type gatewayUsageRateLimitRepo struct {
	service.APIKeyRepository
	data *service.APIKeyRateLimitData
}

func (r *gatewayUsageRateLimitRepo) GetRateLimitData(context.Context, int64) (*service.APIKeyRateLimitData, error) {
	return r.data, nil
}

func TestGatewayUsageQuotaMetadataUsesMYR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	(&GatewayHandler{}).usageQuotaLimited(ctx, ctx, &service.APIKey{Quota: 10}, nil, nil, nil)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, "MYR", body["unit"])
	quota, ok := body["quota"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "MYR", quota["unit"])
}

func TestGatewayUsageRateLimitOnlyMetadataUsesMYR(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	apiKeyService := service.NewAPIKeyService(
		&gatewayUsageRateLimitRepo{data: &service.APIKeyRateLimitData{}},
		nil, nil, nil, nil, nil, nil,
	)

	(&GatewayHandler{apiKeyService: apiKeyService}).usageQuotaLimited(
		ctx,
		ctx,
		&service.APIKey{ID: 1, RateLimit1d: 10},
		nil,
		nil,
		nil,
	)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, "MYR", body["unit"])
	rateLimits, ok := body["rate_limits"].([]any)
	require.True(t, ok)
	require.Len(t, rateLimits, 1)
	rateLimit, ok := rateLimits[0].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "MYR", rateLimit["unit"])
}
