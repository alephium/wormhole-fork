// package middleare contains all the middleware function to use in the API.
package middleware

import (
	"fmt"
	"math"
	"strconv"

	"github.com/alephium/wormhole-fork/explorer-api-server/response"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/gofiber/fiber/v2"
	"github.com/pkg/errors"
	"go.uber.org/zap"
)

var supportedChains = []vaa.ChainID{vaa.ChainIDUnset, vaa.ChainIDEthereum, vaa.ChainIDAlephium, vaa.ChainIDBSC}

func isSupportedChain(chainId vaa.ChainID) bool {
	for _, c := range supportedChains {
		if c == chainId {
			return true
		}
	}
	return false
}

func extractChainID(c *fiber.Ctx, l *zap.Logger, str string) (vaa.ChainID, error) {
	chain, err := c.ParamsInt(str)
	if err != nil {
		requestID := fmt.Sprintf("%v", c.Locals("requestid"))
		l.Error("failed to get chain id parameter", zap.Error(err), zap.Int("chainId", chain),
			zap.String("requestID", requestID))

		return vaa.ChainIDUnset, response.NewInvalidParamError(c, "WRONG CHAIN ID", errors.WithStack(err))
	}
	if chain > math.MaxUint16 {
		return vaa.ChainIDUnset, response.NewInvalidParamError(c, "WRONG CHAIN ID", fmt.Errorf("the chain id greater than MaxUint16"))
	}
	chainId := vaa.ChainID(chain)
	if !isSupportedChain(chainId) {
		return vaa.ChainIDUnset, response.NewInvalidParamError(c, "WRONG CHAIN ID", fmt.Errorf("the chain id is not supported"))
	}
	return chainId, nil
}

// ExtractEmitterChainID get chain parameter from route path.
func ExtractEmitterChainID(c *fiber.Ctx, l *zap.Logger) (vaa.ChainID, error) {
	return extractChainID(c, l, "emitterChain")
}

// ExtractTargetChainID get chain parameter from route path.
func ExtractTargetChainID(c *fiber.Ctx, l *zap.Logger) (vaa.ChainID, error) {
	return extractChainID(c, l, "targetChain")
}

// ExtractEmitterAddr get emitter parameter from route path.
func ExtractEmitterAddr(c *fiber.Ctx, l *zap.Logger) (*vaa.Address, error) {
	emitterStr := c.Params("emitterAddress")
	emitter, err := vaa.StringToAddress(emitterStr)
	if err != nil {
		requestID := fmt.Sprintf("%v", c.Locals("requestid"))
		l.Error("failed to covert emitter to address", zap.Error(err), zap.String("emitterStr", emitterStr),
			zap.String("requestID", requestID))
		return nil, response.NewInvalidParamError(c, "MALFORMED EMITTER_ADDR", errors.WithStack(err))
	}
	return &emitter, nil
}

// ExtractSequence get sequence parameter from route path.
func ExtractSequence(c *fiber.Ctx, l *zap.Logger) (uint64, error) {
	sequence := c.Params("sequence")
	seq, err := strconv.ParseUint(sequence, 10, 64)
	if err != nil {
		requestID := fmt.Sprintf("%v", c.Locals("requestid"))
		l.Error("failed to get sequence parameter", zap.Error(err), zap.String("sequence", sequence),
			zap.String("requestID", requestID))
		return 0, response.NewInvalidParamError(c, "MALFORMED SEQUENCE NUMBER", errors.WithStack(err))
	}
	return seq, nil
}

// ExtractGuardianAddress get guardian address from route path.
func ExtractGuardianAddress(c *fiber.Ctx, l *zap.Logger) (string, error) {
	//TODO: check guardianAddress [vaa.StringToAddress(emitterStr)]
	guardianAddress := c.Params("guardian_address")
	if guardianAddress == "" {
		return "", response.NewInvalidParamError(c, "MALFORMED GUARDIAN ADDR", nil)
	}
	return guardianAddress, nil
}

// ExtractVAAParams get VAA chain, address from route path.
func ExtractVAAChainIDEmitter(c *fiber.Ctx, l *zap.Logger) (vaa.ChainID, *vaa.Address, error) {
	chainID, err := ExtractEmitterChainID(c, l)
	if err != nil {
		return vaa.ChainIDUnset, nil, err
	}
	address, err := ExtractEmitterAddr(c, l)
	if err != nil {
		return chainID, nil, err
	}
	return chainID, address, nil
}

func ExtractVAAEmitterAndTargetChainId(c *fiber.Ctx, l *zap.Logger) (vaa.ChainID, *vaa.Address, vaa.ChainID, error) {
	emitterChain, address, err := ExtractVAAChainIDEmitter(c, l)
	if err != nil {
		return vaa.ChainIDUnset, nil, vaa.ChainIDUnset, err
	}
	targetChain, err := ExtractTargetChainID(c, l)
	if err != nil {
		return emitterChain, address, vaa.ChainIDUnset, err
	}
	return emitterChain, address, targetChain, nil
}

// ExtractVAAParams get VAAA chain, address and sequence from route path.
func ExtractVAAParams(c *fiber.Ctx, l *zap.Logger) (vaa.ChainID, *vaa.Address, vaa.ChainID, uint64, error) {
	emitterChain, address, targetChain, err := ExtractVAAEmitterAndTargetChainId(c, l)
	if err != nil {
		return vaa.ChainIDUnset, nil, vaa.ChainIDUnset, 0, err
	}
	seq, err := ExtractSequence(c, l)
	if err != nil {
		return emitterChain, address, targetChain, 0, err
	}
	return emitterChain, address, targetChain, seq, err
}

// ExtractObservationSigner get signer from route path.
func ExtractObservationSigner(c *fiber.Ctx, l *zap.Logger) (*vaa.Address, error) {
	signer := c.Params("signer")
	signerAddr, err := vaa.StringToAddress(signer)
	if err != nil {
		requestID := fmt.Sprintf("%v", c.Locals("requestid"))
		l.Error("failed to covert signer to address", zap.Error(err), zap.String("signer", signer),
			zap.String("requestID", requestID))
		return nil, response.NewInvalidParamError(c, "MALFORMED SIGNER", errors.WithStack(err))
	}
	return &signerAddr, nil
}

// ExtractObservationHash get a hash from route path.
func ExtractObservationHash(c *fiber.Ctx, l *zap.Logger) (string, error) {
	hash := c.Params("hash")
	if hash == "" {
		return "", response.NewInvalidParamError(c, "MALFORMED HASH", nil)
	}
	return hash, nil
}

func ExtractTransactionId(c *fiber.Ctx, l *zap.Logger) (string, error) {
	txId := c.Params("txId")
	if txId == "" {
		return "", response.NewInvalidParamError(c, "MALFORMED TX ID", nil)
	}
	return txId, nil
}
