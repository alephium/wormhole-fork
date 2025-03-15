import i18next from "i18next";
import { useEffect } from "react";
import styled from "styled-components";

import { Language, languageOptions } from "./languages";
import useStateWithLocalStorage from "../hooks/useStateWithLocalStorage";
import Menu from "./Menu";

interface LanguageSwitchProps {
  className?: string;
}

const LanguageSwitch: React.FC<LanguageSwitchProps> = ({ className }) => {
  const [langValue, setLangValue] = useStateWithLocalStorage<Language>('language', 'en')

  useEffect(() => {
    i18next.changeLanguage(langValue)
  }, [langValue])

  const items = languageOptions.map((lang) => ({
    text: lang.label,
    onClick: () => setLangValue(lang.value)
  }))

  return (
    <Menu
      aria-label="Language"
      label={languageOptions.find((o) => o.value === langValue)?.label || ''}
      items={items}
      direction="up"
      className={className}
    />
  );
};

export default styled(LanguageSwitch)`
  border-radius: 8px;
  background-color: #1B1B1F;
  border: 1px solid rgba(255, 255, 255, 0.08);
`;
