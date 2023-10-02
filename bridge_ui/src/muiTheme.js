import { createTheme, responsiveFontSizes } from "@material-ui/core";
import Switzer from "./fonts/Switzer-Variable.ttf";

export const COLORS = {
  blue: "#1975e6",
  blueWithTransparency: "rgba(25, 117, 230, 0.8)",
  gray: "#4e4e54",
  green: "#0ac2af",
  greenWithTransparency: "rgba(10, 194, 175, 0.8)",
  lightGreen: "rgba(51, 242, 223, 1)",
  lightBlue: "#83b9fc",
  nearBlack: "#242426",
  nearBlackWithMinorTransparency: "rgba(0,0,0,.25)",
  red: "#aa0818",
  darkRed: "#810612",
  white: "#FFFFFF",
  whiteWithTransparency: "rgba(255,255,255,.07)",
};

const switzer = {
  fontFamily: "Switzer",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: 400,
  src: `url(${Switzer}) format('ttf')`,
};

export const theme = responsiveFontSizes(
  createTheme({
    palette: {
      type: "dark",
      background: {
        default: COLORS.nearBlack,
        paper: COLORS.nearBlack,
      },
      divider: COLORS.white,
      text: {
        primary: COLORS.white,
      },
      primary: {
        main: COLORS.blueWithTransparency, // #0074FF
        light: COLORS.lightBlue,
      },
      secondary: {
        main: COLORS.greenWithTransparency, // #00EFD8
        light: COLORS.lightGreen,
      },
      error: {
        main: COLORS.red,
      },
    },

    typography: {
      fontFamily: "'Switzer', sans-serif",
      fontSize: 13,
      h1: {
        fontFamily: "Switzer, sans-serif",
        lineHeight: 0.9,
        letterSpacing: -2,
        fontWeight: 600,
        fontSize: "62px",
      },
      h2: {
        fontWeight: "200",
      },
      h4: {
        fontWeight: "600",
        fontFamily: "Switzer, sans-serif",
        letterSpacing: -1.02,
      },
    },
    overrides: {
      MuiCssBaseline: {
        "@global": {
          "@font-face": [switzer],
          body: {
            overscrollBehaviorY: "none",
            backgroundPosition: "top center",
            backgroundRepeat: "repeat-y",
            backgroundSize: "120%",
          },
          "*": {
            scrollbarWidth: "thin",
            scrollbarColor: `${COLORS.gray} ${COLORS.nearBlackWithMinorTransparency}`,
          },
          "*::-webkit-scrollbar": {
            width: "8px",
            height: "8px",
            backgroundColor: COLORS.nearBlackWithMinorTransparency,
          },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: COLORS.gray,
            borderRadius: "4px",
          },
          "*::-webkit-scrollbar-corner": {
            // this hides an annoying white box which appears when both scrollbars are present
            backgroundColor: "transparent",
          },
        },
      },
      MuiAccordion: {
        root: {
          backgroundColor: COLORS.whiteWithTransparency,
          "&:before": {
            display: "none",
          },
        },
        rounded: {
          "&:first-child": {
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
          },
          "&:last-child": {
            borderBottomLeftRadius: "16px",
            borderBottomRightRadius: "16px",
          },
        },
      },
      MuiAlert: {
        root: {
          borderRadius: "8px",
          border: "1px solid",
        },
      },
      MuiButton: {
        root: {
          borderRadius: "9px",
          letterSpacing: ".1em",
        },
        outlinedSizeSmall: {
          padding: "6px 9px",
          fontSize: "0.70rem",
        },
      },
      MuiLink: {
        root: {
          color: COLORS.lightBlue,
        },
      },
      MuiPaper: {
        rounded: {
          borderRadius: "16px",
          backdropFilter: "blur(4px)",
        },
      },
      MuiStepper: {
        root: {
          backgroundColor: "transparent",
          padding: 0,
        },
      },
      MuiStep: {
        root: {
          backgroundColor: COLORS.whiteWithTransparency,
          backdropFilter: "blur(4px)",
          borderRadius: "16px",
          padding: "32px 32px 16px",
        },
      },
      MuiStepConnector: {
        lineVertical: {
          borderLeftWidth: 0,
        },
      },
      MuiStepContent: {
        root: {
          borderLeftWidth: 0,
          marginLeft: 0,
          paddingLeft: 0,
        },
      },
      MuiStepLabel: {
        label: {
          color: COLORS.white,
          textTransform: "uppercase",
          "&.MuiStepLabel-active": {},
          "&.MuiStepLabel-completed": {},
        },
      },
      MuiTabs: {
        root: {
          borderBottom: `1px solid ${COLORS.white}`,
        },
        indicator: {
          height: "100%",
          background: "linear-gradient(20deg, #f44b1b 0%, #eeb430 100%);",
          zIndex: -1,
        },
      },
      MuiTab: {
        root: {
          color: COLORS.white,
          fontFamily: "Switzer, sans-serif",
          fontWeight: "bold",
          fontSize: 18,
          padding: 12,
          letterSpacing: "-0.69px",
          textTransform: "none",
        },
        textColorInherit: {
          opacity: 1,
        },
      },
      MuiTableCell: {
        root: {
          borderBottom: "none",
        },
      },
    },
  })
);
