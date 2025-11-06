import { createTheme, responsiveFontSizes } from "@mui/material";
import Inter from "./fonts/Inter-Variable.ttf";

export const COLORS = {
  blue: "rgb(9, 137, 241)",
  blueWithTransparency: "rgba(9, 137, 241, 0.8)",
  blueWithStrongTransparency: "rgba(9, 137, 241, 0.1)",
  gray: "rgb(70, 70, 70)",
  green: "rgb(33, 201, 94)",
  greenWithTransparency: "rgba(33, 201, 94, 0.8)",
  greenWithStrongTransparency: "rgba(33, 201, 94, 0.1)",
  lightGreen: "rgba(51, 242, 223, 1)",
  lightBlue: "#909ed3",
  nearWhite: "#ebebeb",
  nearBlackWithMinorTransparency: "rgba(0,0,0,.25)",
  darkGrey: 'rgb(31, 31, 31)',
  darkGrey2: 'rgb(49, 49, 49)',
  red: "rgb(237, 74, 52)",
  redWithTransparency: "rgba(237, 74, 52, 0.8)",
  redWithStrongTransparency: "rgba(237, 74, 52, 0.1)",
  orange: "rgb(255, 160, 44)",
  orangeWithTransparency: "rgba(255, 160, 44, 0.8)",
  orangeWithStrongTransparency: "rgba(255, 140, 0, 0.1)",
  darkRed: "#810612",
  nearBlack: "#101010",
  white: "#FFFFFF",
  whiteWithTransparency: "rgba(255,255,255,.08)",
  whiteWithMediumTransparency: "rgba(255,255,255,.7)",
  whiteWithStrongTransparency: "rgba(255,255,255,.04)"
};

const inter = {
  fontFamily: "Inter",
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
      fontSize: 15,
      color: COLORS.nearWhite,
      h1: {
        fontFamily: "Inter, sans-serif",
        fontWeight: 500,
        fontSize: "28px"
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
          borderRadius: "16px",
          border: "none",
        },
        standardInfo: {
          backgroundColor: COLORS.blueWithStrongTransparency,
          border: `1px solid ${COLORS.blueWithStrongTransparency}`
        },
        standardError: {
          backgroundColor: COLORS.redWithStrongTransparency,
          border: `1px solid ${COLORS.redWithStrongTransparency}`
        },
        standardWarning: {
          backgroundColor: COLORS.orangeWithStrongTransparency,
          border: `1px solid ${COLORS.orangeWithStrongTransparency}`
        },
        standardSuccess: {
          backgroundColor: COLORS.greenWithStrongTransparency,
          border: `1px solid ${COLORS.greenWithStrongTransparency}`
        }
      },
      MuiButton: {
        fontSize: "1.2rem",
        outlinedSizeSmall: {
          padding: "6px 9px",
          fontSize: "0.70rem",
        },
      },
      MuiCircularProgress: {
        svg: {
          overflow: 'visible',
        },
        circle: {
          strokeWidth: 5
        },
      },
      MuiDialog: {
        paper: {
          border: `1px solid ${COLORS.whiteWithTransparency}`,
          borderRadius: "16px"
        }
      },
      MuiDialogContent: {
        root: {
          display: "flex",
          flexDirection: "column",
          padding: "16px",
          gap: 10
        }
      },
      MuiDialogTitle: {
        root: {
          fontSize: "18px",
          padding: "6px 16px",
          borderBottom: `1px solid ${COLORS.whiteWithTransparency}`,
        }
      },
      MuiDialogActions: {
        root: {
          padding: "16px"
        }
      },
      MuiFormControl: {
        root: {
          width: "100%"
        },
        marginNormal: {
          marginTop: 0
        }
      },
      MuiLink: {
        root: {
          color: COLORS.lightBlue,
        },
      },
      MuiList: {
        root: {
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 8
        }
      },
      MuiListItem: {
        root: {
          borderRadius: "12px",
          gap: 14,
          backgroundColor: COLORS.whiteWithStrongTransparency,
        }
      },
      MuiListItemIcon: {
        root: {
          minWidth: 'auto'
        }
      },
      MuiListItemText: {
        root: {
          fontSize: "16px",
          fontWeight: 600
        }
      },
      MuiPaper: {
        rounded: {
          borderRadius: "12px",
          backdropFilter: "blur(4px)"
        },
      },
      MuiPopover: {
        paper: {
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLORS.darkGrey,
          border: `1px solid ${COLORS.whiteWithTransparency}`,
          borderRadius: "16px",
          padding: 10,
          gap: 10,
          boxShadow: "0 30px 70px 10px rgba(0, 0, 0, 1)",
        },
        root: {
          '& .MuiList-root': {
            padding: 0
          }
        }
      },
      MuiSelect: {
        select: {
          backgroundColor: 'transparent',
          gap: "16px"
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
          backgroundColor: 'transparent',
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
