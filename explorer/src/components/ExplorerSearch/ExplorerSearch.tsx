import React, { useEffect, useState } from 'react'
import { navigate, PageProps } from 'gatsby'
import { Box } from "@mui/material";
import ExplorerMessageSearchForm from "./ExplorerMessageSearchForm";
import ExplorerTxSearchForm from "./ExplorerTxSearchForm";

interface ExplorerSearchProps {
    location: PageProps["location"],
}
const ExplorerSearch = ({ location }: ExplorerSearchProps) => {
    const [showMessageIdForm, setShowMessageIdForm] = useState<boolean>(false);

    useEffect(() => {
        if (location.search) {
            const searchParams = new URLSearchParams(location.search);

            const emitterChain = searchParams.get("emitterChain");
            const address = searchParams.get("emitterAddress");
            const targetChain = searchParams.get("targetChain")
            const seq = searchParams.get("sequence");
            const tx = searchParams.get("txId");
            if (!tx && emitterChain && address && targetChain && seq) {
                setShowMessageIdForm(true);
            }
        } else {
            setShowMessageIdForm(false)
        }
    }, [location.search])

    const switchForm = () => {
        if (location.search) {
            navigate('/explorer')
        }
        setShowMessageIdForm(!showMessageIdForm)
    }

    return (
        <Box
            sx={{
                backgroundColor: "rgba(255,255,255,.07)",
                borderRadius: "28px",
                mt: 4,
                p: 4,
            }}
        >
            {showMessageIdForm ? (
                <ExplorerMessageSearchForm
                    location={location}
                    toggleFormType={switchForm}
                    formName="messageID"
                />
            ) : (
                <ExplorerTxSearchForm
                    location={location}
                    toggleFormType={switchForm}
                    formName="txID"
                />
            )}
        </Box>
    )
}

export default ExplorerSearch
