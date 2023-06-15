// package middleare contains all the middleware function to use in the API.
package middleware

import (
	errs "github.com/alephium/wormhole-fork/explorer-api-server/internal/errors"
	"github.com/alephium/wormhole-fork/explorer-api-server/response"
	"github.com/pkg/errors"

	"github.com/gofiber/fiber/v2"
)

// ErrorHandler define a fiber custom error handler. This function process all errors
// returned from any handlers in the stack.
//
// To setup this function we must set the ErrorHandler field of the fiber.Config struct
// with this function and create a new fiber with this config.
//
// example: fiber.New(fiber.Config{ErrorHandler: errs.APIErrorHandler}
func ErrorHandler(ctx *fiber.Ctx, err error) error {
	var apiError response.APIError
	switch {
	case errors.As(err, &apiError):
		ctx.Status(apiError.StatusCode).JSON(apiError)
	case errors.Is(err, errs.ErrNotFound):
		apiError = response.NewNotFoundError(ctx)
		ctx.Status(fiber.StatusNotFound).JSON(apiError)
	default:
		apiError = response.NewInternalError(ctx, err)
		ctx.Status(fiber.StatusInternalServerError).JSON(apiError)
	}
	return nil
}
