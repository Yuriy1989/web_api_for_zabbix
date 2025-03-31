import MainMenu from "../mainMenu/mainMenu";
import "./Header.css";

const Header = () => {
  return (
    <>
      <div className="Header">
        <header className="Header-header">
          <p>Web API for zabbix</p>
        </header>
        <MainMenu />
      </div>
    </>
  )
}

export default Header;