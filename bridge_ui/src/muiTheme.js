import { createTheme, responsiveFontSizes } from "@material-ui/core";
import Inter from "./fonts/Inter-Variable.ttf";

export const COLORS = {
  blue: "#2f8cef",
  blueWithTransparency: "rgba(25, 117, 230, 0.8)",
  gray: "rgb(70, 70, 70)",
  green: "#0ac2af",
  greenWithTransparency: "rgba(10, 194, 175, 0.8)",
  lightGreen: "rgba(51, 242, 223, 1)",
  lightBlue: "#909ed3",
  nearWhite: "#f0f0f0",
  nearBlackWithMinorTransparency: "rgba(0,0,0,.25)",
  darkGrey: 'rgb(30, 30, 30)',
  red: "#aa0818",
  darkRed: "#810612",
  nearBlack: "#101010",
  white: "#FFFFFF",
  whiteWithTransparency: "rgba(255,255,255,.06)",
};

const inter = {
  fontFamily: "Inter Variable",
  fontStyle: "normal",
  fontDisplay: "swap",
  fontWeight: "100 1000",
  src: `url(${Inter}) format('truetype')`,
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
        primary: 'rgba(255, 255, 255, 0.9)',
      },
      primary: {
        main: COLORS.blue, // #0074FF
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
      fontFamily: "'Inter', sans-serif",
      fontSize: 14,
      h1: {
        fontFamily: "Inter, sans-serif",
        lineHeight: 0.9,
        fontWeight: 600,
        fontSize: "62px",
      },
      h2: {
        fontWeight: "200",
      },
      h4: {
        fontWeight: "600",
        fontFamily: "Inter, sans-serif",
        letterSpacing: -1.02,
      },
    },
    overrides: {
      MuiCssBaseline: {
        "@global": {
          "@font-face": [inter],
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
          // Override the ripple keyframe animation
          "@keyframes MuiTouchRipple-keyframes-enter": {
            "0%": {
              transform: "scale(0)",
              opacity: 0.1,
            },
            "100%": {
              transform: "scale(1)",
              opacity: 0.3,
            },
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
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
          },
          "&:last-child": {
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
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
          transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          '&:hover': {
            transform: 'scale(1.005)',
            filter: 'brightness(1.02)'
          }
        },
        outlinedSizeSmall: {
          padding: "6px 9px",
          fontSize: "0.70rem",
        },
      },
      MuiDialog: {
        paper: {
          border: `1px solid ${COLORS.whiteWithTransparency}`,
          borderRadius: "16px"
        }
      },
      MuiDialogTitle: {
        root: {
          padding: "6px 16px",
          borderBottom: `1px solid ${COLORS.whiteWithTransparency}`,
        }
      },
      MuiLink: {
        root: {
          color: COLORS.lightBlue,
        },
      },
      MuiPaper: {
        rounded: {
          borderRadius: "12px",
          backdropFilter: "blur(4px)"
        },
      },
      MuiPopover: {
        paper: {
          backgroundColor: COLORS.darkGrey,
          border: `1px solid ${COLORS.whiteWithTransparency}`,

          "& .MuiList-padding": {
            padding: "0px"
          }
        }
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
          borderRadius: "12px",
          padding: "20px",
          border: `1px solid ${COLORS.whiteWithTransparency}`,
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
          fontSize: "18px",
          fontWeight: 600,
          "&.MuiStepLabel-active": {},
          "&.MuiStepLabel-completed": {},
        },
      },
      MuiTabs: {
        root: {
          backgroundColor: COLORS.whiteWithTransparency,
          borderRadius: "14px",
          padding: "5px 0",
        },
        indicator: {
          height: "100%",
          borderRadius: "12px",
          zIndex: -1,
        },
      },
      MuiTab: {
        root: {
          color: COLORS.white,
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          fontSize: 18,
          padding: 12,
          letterSpacing: "-0.69px",
          textTransform: "none",
          borderRadius: "12px",
          margin: "0 5px",
          "&:hover": {
            backgroundColor: COLORS.whiteWithTransparency,
          },
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
      MuiInputBase: {
        root: {
          backgroundColor: COLORS.darkGrey,
          '& fieldset': {
            borderRadius: "12px",
            border: `1px solid ${COLORS.whiteWithTransparency}`,
          },
        }
      },
      MuiOutlinedInput: {
        root: {
          borderRadius: "12px",
          '&:hover fieldset': {
            border: `1px solid ${COLORS.gray} !important`,
          },

          '& fieldset': {
            transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
          }
        }
      },
      MuiTooltip: {
        tooltip: {
          backgroundColor: COLORS.darkGrey,
          border: `1px solid ${COLORS.whiteWithTransparency}`,
          borderRadius: "12px",
          backdropFilter: "blur(4px)",
          boxShadow: "0 0 30px 0 rgba(0, 0, 0, 0.15)",
          padding: '6px'
        }
      },
       MuiTouchRipple: {
         root: {
           "& .MuiTouchRipple-ripple": {
             filter: "blur(8px)",
             animation: "MuiTouchRipple-keyframes-enter 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
           },
           "& .MuiTouchRipple-rippleVisible": {
             filter: "blur(12px) brightness(1.2)",
             backgroundColor: "rgba(255, 255, 255, 0.1)",
           },
         }
       }
    },
  })
);
