import { getLocalTokenInfo } from "@alephium/wormhole-sdk";
import { Button, makeStyles } from "@material-ui/core";
import { useCallback } from "react";
import { useSelector } from "react-redux";
import { selectTransferTargetAsset } from "../../store/selectors";
import { CLUSTER } from "../../utils/consts";
import { getAlephiumTokenLogoURI } from "../../utils/alephium";
import { AlephiumWindowObject } from '@alephium/get-extension-wallet'
import { useSnackbar } from "notistack";
import { Alert } from "@material-ui/lab";
import { useWallet } from "@alephium/web3-react";
import { SignerProvider } from "@alephium/web3";

const useStyles = makeStyles((theme) => ({
  addButton: {
    display: "block",
    margin: `${theme.spacing(1)}px auto 0px`,
  },
}));

function isExtensionWallet(signer: SignerProvider) {
  return typeof (signer as any)['request'] === 'function'
}

export default function AddToAlephium() {
  const classes = useStyles();
  const targetAsset = useSelector(selectTransferTargetAsset);
  const { enqueueSnackbar } = useSnackbar()
  const alphWallet = useWallet()
  const handleClick = useCallback(() => {
    if (alphWallet?.nodeProvider !== undefined && targetAsset) {
      (async (nodeProvider) => {
        try {
          const tokenInfo = await getLocalTokenInfo(nodeProvider, targetAsset)
          const logoURI = getAlephiumTokenLogoURI(tokenInfo.id)
          const windowObject = alphWallet.signer as AlephiumWindowObject
          console.log(`add new token, tokenName: ${tokenInfo.name}, tokenSymbol: ${tokenInfo.symbol}, tokenId: ${tokenInfo.id}`)
          const result = await windowObject.request({
            type: 'AddNewToken',
            params: {
              id: tokenInfo.id,
              networkId: CLUSTER,
              symbol: tokenInfo.symbol,
              decimals: tokenInfo.decimals,
              name: `${tokenInfo.name} (AlphBridge)`,
              logoURI: logoURI
            }
          })
          if (!result) { // the token already exists
            enqueueSnackbar(null, {
              content: <Alert severity="success">The token already exists</Alert>,
            })
          }
        } catch (error) {
          console.error(`failed to add new token, error: ${error}`)
        }
      })(alphWallet.nodeProvider)
    }
  }, [alphWallet, targetAsset, enqueueSnackbar])
  return alphWallet.connectionStatus === 'connected' && isExtensionWallet(alphWallet.signer) ? (
    <Button
      onClick={handleClick}
      size="small"
      variant="outlined"
      className={classes.addButton}
    >
      Add to Wallet
    </Button>
  ) : null
}
