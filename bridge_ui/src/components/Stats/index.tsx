import { Container } from "@mui/material";
import { useTranslation } from "react-i18next";
import HeaderText from "../HeaderText";
import TVLStats from "./TVLStats";
import VolumeStats from "./VolumeStats";

const StatsRoot = () => {
  const { t } = useTranslation()

  return (
    <Container maxWidth="lg">
      <Container maxWidth="md">
        <HeaderText white>{t("Stats")}</HeaderText>
      </Container>
      <TVLStats />
      <VolumeStats />
    </Container>
  );
};

export default StatsRoot;
