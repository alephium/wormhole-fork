// package middleare contains all the middleware function to use in the API.
package middleware

import (
	"fmt"
	"strconv"

	"github.com/alephium/wormhole-fork/explorer-api-server/internal/pagination"
	"github.com/gofiber/fiber/v2"
)

func ExtractPagination(ctx *fiber.Ctx) (*pagination.Pagination, error) {
	pageNumberStr := ctx.Query("page", "1")
	pageNumber, err := strconv.ParseUint(pageNumberStr, 10, 64)
	if err != nil {
		return nil, err
	}
	if pageNumber == 0 {
		return nil, fmt.Errorf("page must be a positive integer")
	}

	pageSizeStr := ctx.Query("pageSize", "50")
	pageSize, err := strconv.ParseUint(pageSizeStr, 10, 64)
	if err != nil {
		return nil, err
	}
	if pageSize == 0 {
		return nil, fmt.Errorf("pageSize must be a positive integer")
	}

	sortOrder := ctx.Query("sortOrder", "DESC")
	sortBy := ctx.Query("sortBy", "indexedAt")

	p := pagination.BuildPagination(int64(pageNumber), int64(pageSize), sortOrder, sortBy)
	return p, nil
}
