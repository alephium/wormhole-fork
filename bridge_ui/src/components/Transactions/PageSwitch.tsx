import { makeStyles, Button } from "@material-ui/core";
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';

const useStyles = makeStyles((theme) => ({
  container: {
    justifyContent: 'center',
    display: 'flex',
    marginTop: '20px',
    height: '30px',
  },
  button: {
    fontSize: 'inherit',
    display: "flex",
    fontFamily: "Suisse BP Intl, sans-serif"
  },
  pageNumber: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    textAlign: 'center',
    fontSize: 'inherit',
    fontFamily: "Suisse BP Intl, sans-serif"
  }
}));

export const DefaultPageSize = 10

interface PageSwitchProps {
  totalNumberOfPages: number
  pageNumber: number
  setPageNumber: (n: number) => void
  numberOfElementsLoaded?: number
}

export const PageSwitch = ({ pageNumber, setPageNumber, totalNumberOfPages, numberOfElementsLoaded }: PageSwitchProps) => {
  const classes = useStyles()
  const handlePageSwitch = (direction: 'previous' | 'next') => {
    setPageNumber(direction === 'previous' ? pageNumber - 1 : pageNumber + 1)
  }

  if (totalNumberOfPages === 0) return null

  return (
    <div className={classes.container}>
      <Button disabled={pageNumber === 1} onClick={() => handlePageSwitch('previous')} className={classes.button}>
        <ChevronLeft />
        <span>Previous</span>
      </Button>
      <div className={classes.pageNumber}>
        {pageNumber}
        {totalNumberOfPages && <span>{` / ${totalNumberOfPages}`}</span>}
      </div>
      <Button
        disabled={
          totalNumberOfPages
            ? totalNumberOfPages === pageNumber
            : numberOfElementsLoaded
            ? numberOfElementsLoaded < DefaultPageSize
            : false
        }
        onClick={() => handlePageSwitch('next')}
        className={classes.button}
      >
        <span>Next</span>
        <ChevronRight />
      </Button>
    </div>
  )
}
