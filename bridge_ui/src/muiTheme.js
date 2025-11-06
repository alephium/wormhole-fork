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
      mode: "dark",
      background: {
        default: COLORS.nearBlack,
        paper: COLORS.nearBlack,
      },
      divider: COLORS.white,
      text: {
        primary: 'rgba(255, 255, 255, 0.9)',
      },
      primary: {
        main: COLORS.blue,
        light: COLORS.lightBlue,
      },
      secondary: {
        main: COLORS.greenWithTransparency,
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
    components: {
      Mui: {
        styleOverrides: {
          selected: {
            backgroundColor: "rgba(255, 255, 255, 0.16)",
          }
        }
      },
      MuiCssBaseline: {
        styleOverrides: {
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
        styleOverrides: {
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
        }
      },
      MuiAlert: {
        styleOverrides: {
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
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            color: 'rgba(255, 255, 255, 0.9)'
          },
          fontSize: "1.2rem",
          outlinedSizeSmall: {
            padding: "6px 9px",
            fontSize: "0.70rem",
          },
        }
      },
      MuiCircularProgress: {
        styleOverrides: {
          svg: {
            overflow: 'visible',
          },
          circle: {
            strokeWidth: 5
          },
        }
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${COLORS.whiteWithTransparency}`,
            borderRadius: "16px"
          }
        }
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            display: "flex",
            flexDirection: "column",
            padding: "16px",
            gap: 10,
            paddingTop: '16px !important'
          }
        }
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            fontSize: "18px",
            padding: "6px 16px",
            borderBottom: `1px solid ${COLORS.whiteWithTransparency}`,
          }
        }
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            padding: "16px"
          }
        }
      },
      MuiFormControl: {
        styleOverrides: {
          root: {
            width: "100%"
          },
          marginNormal: {
            marginTop: 0
          }
        }
      },
      MuiLink: {
        defaultProps: {
          underline: 'hover',
        },
        styleOverrides: {
          root: {
            color: COLORS.lightBlue,
          }
        },
      },
      MuiList: {
        styleOverrides: {
          root: {
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 8
          }
        }
      },
      MuiListItem: {
        styleOverrides: {
          root: {
            borderRadius: "12px",
            gap: 14,
            backgroundColor: COLORS.whiteWithStrongTransparency,
          }
        }
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            borderRadius: "12px",
            gap: 14,
            backgroundColor: COLORS.whiteWithStrongTransparency,
            "&.Mui-selected": {
              backgroundColor: "rgba(255, 255, 255, 0.16)",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.16)",
              },
              "&:active": {
                backgroundColor: "rgba(255, 255, 255, 0.16)",
              },
              "&:focus": {
                backgroundColor: "rgba(255, 255, 255, 0.16)",
              },
            },
          }
        }
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 'auto'
          }
        }
      },
      MuiListItemText: {
        styleOverrides: {
          root: {
            fontSize: "16px",
            fontWeight: 600
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          rounded: {
            borderRadius: "12px",
            backdropFilter: "blur(4px)"
          },
        }
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            display: "flex",
            flexDirection: "column",
            backgroundColor: COLORS.darkGrey,
            border: `1px solid ${COLORS.whiteWithTransparency}`,
            borderRadius: "16px",
            padding: 10,
            gap: 10,
            boxShadow: "0 30px 70px 10px rgba(0, 0, 0, 1)",
            backgroundImage: 'none'
          },
          root: {
            '& .MuiList-root': {
              padding: 0
            }
          }
        }
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            backgroundColor: 'transparent',
            gap: "16px"
          }
        }
      },
      MuiStepper: {
        styleOverrides: {
          root: {
            backgroundColor: "transparent",
            padding: 0,
          },
        }
      },
      MuiStep: {
        styleOverrides: {
          root: {
            backgroundColor: COLORS.whiteWithTransparency,
            backdropFilter: "blur(4px)",
            borderRadius: "12px",
            padding: "20px",
            border: `1px solid ${COLORS.whiteWithTransparency}`,
          },
        }
      },
      MuiStepConnector: {
        styleOverrides: {
          lineVertical: {
            borderLeftWidth: 0,
          },
        }
      },
      MuiStepContent: {
        styleOverrides: {
          root: {
            borderLeftWidth: 0,
            marginLeft: 0,
            paddingLeft: 0,
          },
        }
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            color: COLORS.white,
            fontSize: "18px",
            fontWeight: 600,
            "&.MuiStepLabel-active": {},
            "&.MuiStepLabel-completed": {},
          },
        }
      },
      MuiTabs: {
        styleOverrides: {
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
        }
      },
      MuiTab: {
        styleOverrides: {
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
            "&.Mui-selected": {
              color: COLORS.white
            },
          },
          textColorInherit: {
            opacity: 1,
          },
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: "none",
          },
        }
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            backgroundColor: 'transparent',
            '& fieldset': {
              borderRadius: "12px",
              border: `1px solid ${COLORS.whiteWithTransparency}`,
            },
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: "12px",
            '& fieldset': {
              transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }
          }
        }
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: COLORS.darkGrey,
            border: `1px solid ${COLORS.whiteWithTransparency}`,
            borderRadius: "12px",
            backdropFilter: "blur(4px)",
            boxShadow: "0 0 30px 0 rgba(0, 0, 0, 0.15)",
            padding: '6px'
          }
        }
      },
       MuiTouchRipple: {
        styleOverrides: {
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
       }
    },
  })
);
