import './App.css';
import { api } from '../utils/Api';

function App() {

  const clickButtonGetAllHosts = (e) => {
    e.preventDefault();
    console.log('clickButtonGetAllHosts');
    const data = {
      name: 'Admin',
      password: 'zabbix',
    }
    api.getApi(data)
      .then(res => {
        console.log("res", res);
        api.getAllHosts(res.result)
          .then(res => {
            console.log('clickButtonGetAllHosts', res)
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  }

  const clickButtonGetAllHostsByTag = (e) => {
    e.preventDefault();
    console.log('clickButtonGetAllHostsByTag');
    const data = {
      name: 'Admin',
      password: 'zabbix',
    }
    api.getApi(data)
      .then(res => {
        console.log("res", res);
        api.getAllHostsByService(res.result, 'service', 'home')
          .then(res => {
            console.log('clickButtonGetAllHostsByTag', res)
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  }

  const clickButtonGetAllTriggers = (e) => {
    e.preventDefault();
    console.log('clickButtonGetAllTriggers');
    const data = {
      name: 'Admin',
      password: 'zabbix',
    }
    api.getApi(data)
      .then(res => {
        console.log("res", res);
        api.getAllHostsByService(res.result, 'service', 'home')
          .then(results => {
            console.log('clickButtonGetAllHostsByTag', results)
            const hostIds = results.result.map(host => host.hostid);
            console.log("hostIds", hostIds);
            api.getAllTriggersByHost(res.result, hostIds)
              .then(ress => {
                console.log("all triggers = ", ress);
              })
          })
          .catch((res) => console.log(res));
      })
      .catch((res) => console.log(res));
  }


  return (
    <>
      <div className="App">
        <header className="App-header">
          <p>
            Web API for zabbix
          </p>
        </header>
      </div>
      <main className='main'>
        <form className='form'>
          <input className='serviceName'></input>
          <button onClick={e => clickButtonGetAllHosts(e)} className='button'>Выгрузить все хосты</button>
          <button onClick={e => clickButtonGetAllHostsByTag(e)} className='button'>Выгрузить хосты по наименования тега</button>
          <button onClick={e => clickButtonGetAllTriggers(e)} className='button'>Выгрузить триггеры по наименования тега</button>
        </form>
      </main>
    </>
  );
}

export default App;
