package common

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type NetworkId = uint8

const MAINNET NetworkId = 0
const TESTNET NetworkId = 1
const DEVNET NetworkId = 2
const UNKNOWN_NETWORK NetworkId = 3

type ChainConfig struct {
	GroupIndex uint8     `json:"groupIndex,omitempty"`
	NodeUrl    string    `json:"nodeUrl"`
	Contracts  Contracts `json:"contracts"`

	TokenBridgeEmitterAddress string `json:"tokenBridgeEmitterAddress"`
	CoreEmitterAddress        string `json:"coreEmitterAddress"`
}

type Contracts struct {
	Governance  string `json:"governance"`
	TokenBridge string `json:"tokenBridge"`
}

type GuardianConfig struct {
	GovernanceChainId        uint16   `json:"governanceChainId"`
	GovernanceEmitterAddress string   `json:"governanceEmitterAddress"`
	GuardianUrls             []string `json:"guardianUrls"`
}

type EmitterAddress struct {
	ChainID vaa.ChainID
	Emitter string
}

type BridgeConfig struct {
	Network          NetworkId
	Alephium         *ChainConfig
	Ethereum         *ChainConfig
	Bsc              *ChainConfig
	Guardian         *GuardianConfig
	EmitterAddresses []EmitterAddress
}

var configPath *string

func getConfigPath() (*string, error) {
	if configPath != nil {
		return configPath, nil
	}
	path, err := os.Executable()
	if err != nil {
		return nil, err
	}
	cfgPath := filepath.Join(filepath.Dir(path), "configs")
	configPath = &cfgPath
	return configPath, nil
}

type validateFunc[T any] func(*T) error

func readConfig[T any](path string, validate validateFunc[T]) (*T, error) {
	var config T
	bytes, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(bytes, &config); err != nil {
		return nil, err
	}
	if validate == nil {
		return &config, nil
	}
	if err := validate(&config); err != nil {
		return nil, err
	}
	return &config, nil
}

func ReadGuardianConfig(network string) (*GuardianConfig, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return nil, err
	}
	fileName := fmt.Sprintf("%s.json", network)
	path := filepath.Join(*configPath, "guardian", fileName)
	validate := func(config *GuardianConfig) error {
		if config.GovernanceEmitterAddress == "" {
			return fmt.Errorf("empty governance emitter address in guardian config: %s", path)
		}
		if len(config.GuardianUrls) == 0 {
			return fmt.Errorf("empty guardian urls in guardian config: %s", path)
		}
		return nil
	}
	return readConfig(path, validate)
}

func readAndValidateChainConfig(chain string, network string) (*ChainConfig, error) {
	configPath, err := getConfigPath()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(*configPath, chain, network)
	validate := func(config *ChainConfig) error {
		if config.Contracts.Governance == "" {
			return fmt.Errorf("empty governance address in config %s", path)
		}
		if config.Contracts.TokenBridge == "" {
			return fmt.Errorf("empty token bridge address in config %s", path)
		}
		if len(config.CoreEmitterAddress) != 64 {
			return fmt.Errorf("invalid core emitter address in config %s", path)
		}
		if len(config.TokenBridgeEmitterAddress) != 64 {
			return fmt.Errorf("invalid token bridge emitter address in config %s", path)
		}
		return nil
	}
	return readConfig(path, validate)
}

func ReadAlephiumConfig(network string) (*ChainConfig, error) {
	fileName := fmt.Sprintf("%s.json", network)
	return readAndValidateChainConfig("alephium", fileName)
}

func ReadEthereumConfig(network string) (*ChainConfig, error) {
	fileName := fmt.Sprintf("%s.json", network)
	return readAndValidateChainConfig("ethereum", fileName)
}

func ReadBscConfig(network string) (*ChainConfig, error) {
	fileName := fmt.Sprintf("%s.json", network)
	return readAndValidateChainConfig("bsc", fileName)
}

func toNetworkId(network string) (NetworkId, error) {
	switch network {
	case "mainnet":
		return MAINNET, nil
	case "testnet":
		return TESTNET, nil
	case "devnet":
		return DEVNET, nil
	default:
		return UNKNOWN_NETWORK, fmt.Errorf("invalid network %s", network)
	}
}

func ReadConfigsByNetwork(network string) (*BridgeConfig, error) {
	networkId, err := toNetworkId(network)
	if err != nil {
		return nil, err
	}
	alphConfig, err := ReadAlephiumConfig(network)
	if err != nil {
		return nil, err
	}
	ethConfig, err := ReadEthereumConfig(network)
	if err != nil {
		return nil, err
	}
	bscConfig, err := ReadBscConfig(network)
	if err != nil {
		return nil, err
	}
	guardianConfig, err := ReadGuardianConfig(network)
	if err != nil {
		return nil, err
	}
	emitterAddresses := []EmitterAddress{
		{vaa.ChainIDEthereum, alphConfig.TokenBridgeEmitterAddress},
		{vaa.ChainIDAlephium, ethConfig.TokenBridgeEmitterAddress},
	}
	return &BridgeConfig{
		Network:          networkId,
		Alephium:         alphConfig,
		Ethereum:         ethConfig,
		Bsc:              bscConfig,
		Guardian:         guardianConfig,
		EmitterAddresses: emitterAddresses,
	}, nil
}
