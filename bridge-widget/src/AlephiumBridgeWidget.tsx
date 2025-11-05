import { useEffect } from 'react';

const AlephiumBridgeWidget = () => {
  useEffect(() => {
    // IMPORTANT: This is a workaround to expose the Redux store to the window object so it can be used in automated tests.
    if (!globalThis.dispatchReduxAction) {
      (window as any).dispatchReduxAction = (action: any) => {
        // store.dispatch(action);
      };
    }
  }, []);

  return <div>HELLO from the Alephium Bridge Widget!</div>;
};

export default AlephiumBridgeWidget;
