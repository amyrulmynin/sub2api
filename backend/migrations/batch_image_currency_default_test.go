package migrations

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMigration173SetsBatchImageCurrencyDefaultToMYR(t *testing.T) {
	content, err := FS.ReadFile("173_set_batch_image_currency_default_myr.sql")
	require.NoError(t, err)

	sql := string(content)
	require.Contains(t, sql, "ALTER TABLE batch_image_jobs")
	require.Contains(t, sql, "ALTER COLUMN currency SET DEFAULT 'MYR'")
	require.NotContains(t, sql, "UPDATE batch_image_jobs")
}
