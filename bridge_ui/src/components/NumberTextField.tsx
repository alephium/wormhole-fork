import {
  Button,
  InputAdornment,
  TextField,
  TextFieldProps,
} from "@material-ui/core";
import { useTranslation } from "react-i18next";

export default function NumberTextField({
  onMaxClick,
  ...props
}: TextFieldProps & { onMaxClick?: () => void }) {
  const { t } = useTranslation();
  return (
    <TextField
      type="number"
      {...props}
      InputProps={{
        endAdornment: onMaxClick ? (
          <InputAdornment position="end">
            <Button
              onClick={onMaxClick}
              disabled={props.disabled}
              variant="outlined"
            >
              {t("Max")}
            </Button>
          </InputAdornment>
        ) : undefined,
        ...(props?.InputProps || {}),
      }}
    ></TextField>
  );
}
