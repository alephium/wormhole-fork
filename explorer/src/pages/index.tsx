import { PageProps } from "gatsby";
import { Box, } from "@mui/material";
import React, { useEffect } from "react";
import ExplorerSearch from "../components/ExplorerSearch/ExplorerSearch"
import ExplorerStats from "../components/ExplorerStats/ExplorerStats";
import HeroText from "../components/HeroText";
import Layout from "../components/Layout";
import NetworkSelect from "../components/NetworkSelect";
import shape1 from "../images/index/shape2.svg";
import { SEO } from "../components/SEO";
import shapes from "../images/shape.png";

import { paralaxGsap, animateSwirl } from "../utils/animations";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ExplorerQueryValues {
  emitterChain: number;
  emitterAddress: string;
  targetChain: number;
  sequence: string;
  txId: string;
}

const ExplorerPage = ({ location }: PageProps) => {
  const [emitterChain, setEmitterChain] =
    React.useState<ExplorerQueryValues["emitterChain"]>();
  const [emitterAddress, setEmitterAddress] =
    React.useState<ExplorerQueryValues["emitterAddress"]>();
  const [targetChain, setTargetChain] =
    React.useState<ExplorerQueryValues["targetChain"]>();
  const [sequence, setSequence] =
    React.useState<ExplorerQueryValues["sequence"]>();
  const [txId, setTxId] = React.useState<ExplorerQueryValues["txId"]>();
  const [doneReadingQueryParams, setDoneReadingQueryParams] =
    React.useState<boolean>(false);

  React.useEffect(() => {
    if (location.search) {
      // take searchparams from the URL and set the values in the form
      const searchParams = new URLSearchParams(location.search);

      const emitterChainParam = searchParams.get("emitterChain");
      const address = searchParams.get("emitterAddress");
      const targetChainParam = searchParams.get("targetChain")
      const seq = searchParams.get("sequence");
      const tx = searchParams.get("txId");

      // if the search params are different form values, update state
      if (Number(emitterChainParam) !== emitterChain) {
        setEmitterChain(Number(emitterChainParam) || undefined);
      }
      if (address !== emitterAddress) {
        setEmitterAddress(address || undefined);
      }
      if (Number(targetChainParam) !== targetChain) {
        setTargetChain(Number(targetChainParam) || undefined);
      }
      if (seq !== sequence) {
        setSequence(seq || undefined);
      }
      if (tx !== txId) {
        setTxId(tx || undefined);
      }
    } else {
      // clear state
      setEmitterChain(undefined);
      setEmitterAddress(undefined);
      setTargetChain(undefined)
      setSequence(undefined);
      setTxId(undefined);
    }
    // be explicit about when it is ok to render
    setDoneReadingQueryParams(true);
  }, [location.search]);


  const headerImage = React.useRef<HTMLCanvasElement>(null);
  const gradient_1 = React.useRef<HTMLCanvasElement>(null);
  const shapeRight = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {

    gsap.registerPlugin(ScrollTrigger);
    var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    if (viewportWidth > 992) {
      animateSwirl(headerImage);
      paralaxGsap(gradient_1, 1000, "-50% 100%");
      paralaxGsap(shapeRight, 200, "20% 100%");
    }
    
  }, [])

  return (
    <Layout>
      <SEO
        title="Explorer"
        description="Explore real-time movement of information and value around the Alephium bridge."
        pathname={location.pathname}
      />
      <Box sx={{ position: "relative", marginTop: 17 }}>
        {/* <Box
            sx={{
              position: "absolute",
              zIndex: -2,
              bottom: '-220px',
              left: '20%',
              background: 'radial-gradient(closest-side at 50% 50%, #5189C8 0%, #5189C800 100%) ',
              transform: 'matrix(-0.19, 0.98, -0.98, -0.19, 0, 0)',
              width: 1609,
              height: 1264,
              pointerEvents: 'none',
              opacity: 0.7,
            }}
          /> */}
        {/* <Box
          ref={headerImage}
          sx={{
            position: "absolute",
            zIndex: -1,
            transform: "translate(0px, -25%)",
            background: `url(${shape1})`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top -540px center",
            backgroundSize: "2070px 1155px",
            width: "100%",
            height: 1155,
          }}
        /> */}
        <HeroText
          heroSpans={["Check the Stats"]}
          subtitleText={[
            "Explore real-time movement of information and",
            "value around the Alephium bridge.",
          ]}
        />
      </Box>
      <Box sx={{position: 'relative'}}>
      {/* <Box
          ref={gradient_1}
          sx={{
            position: "absolute",
            zIndex: -2,
            top: '0',
            background: 'radial-gradient(closest-side at 50% 50%, #5189C8 0%, #5189C800 100%) ',
            transform: 'matrix(-0.67, 0.74, -0.74, -0.67, 0, 0)',
            left: '70%',
            width: 1077,
            height: 1329,
            pointerEvents: 'none',
            opacity: 0.64,
          }}
        />  */}
      {/* <Box
            ref={shapeRight}
            sx={{
              position: "absolute",
              zIndex: -1,
              background: `url(${shapes})`,
              backgroundSize: 'contain',
              top: '0',
              left: "85%",
              transform: 'scaleX(-1)',
              width: 1227,
              height: 1018,
              pointerEvents: 'none',
              display:{xs: 'none', md: 'block'},
            }}
          />   */}
      <Box sx={{ maxWidth: 1220, mx: "auto", mt: 30, px: 3.75 }}>
        <Box
          sx={{
            px: 4,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box sx={{ flexGrow: 1 }} />
          <NetworkSelect />
        </Box>
      </Box>


        <Box sx={{ maxWidth: 1220, mx: "auto", px: 3.75 }}>

          {doneReadingQueryParams && <>

            <ExplorerSearch location={location} />

            {!(emitterChain && emitterAddress && targetChain && sequence) && // if there is no messageId query &&
              !txId && (                                      // if there is no transactionId query
                <ExplorerStats
                  emitterChain={emitterChain}
                  emitterAddress={emitterAddress}
                />
              )}

          </>}
        </Box>
      </Box>
    </Layout>
  );
};

export default ExplorerPage;
