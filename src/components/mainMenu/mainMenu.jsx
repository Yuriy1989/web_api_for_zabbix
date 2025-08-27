import React, { useState } from 'react';
import { AppstoreOutlined, MailOutlined, SettingOutlined, ExceptionOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { NavLink, Link } from 'react-router';
const items = [
  {
    key: 'main',
    icon: <AppstoreOutlined />,
    label: (
      <NavLink to='/'>Главная</NavLink>
    ),
  },
  {
    key: 'reports',
    icon: <ExceptionOutlined />,
    label: 'Отчеты',
    children: [
      {
        label: (<NavLink to='/reportsServices'>Отчеты по сервисам</NavLink>),
        key: 'setting:1',
      },
      {
        label: (<NavLink to='/reportsTemplates'>Отчеты по шаблонам</NavLink>),
        key: 'setting:2',
      },
      {
        label: (<NavLink to='/reportsGroups'>Отчеты по группам</NavLink>),
        key: 'setting:3',
      },
      {
        label: (<NavLink to='/reportsScripts'>Отчеты по scripts</NavLink>),
        key: 'setting:4',
      },
      {
        label: (<NavLink to='/reportsError'>Отчеты по дублирующим IP</NavLink>),
        key: 'setting:5',
      },
    ]
  },
  // {
  //   key: 'scripts',
  //   icon: <AppstoreOutlined />,
  //   label: 'Скрипты',
  //   children: [
  //     {
  //       label: 'Item 1',
  //       key: 'setting:5',
  //     },
  //     {
  //       label: 'Item 2',
  //       key: 'setting:6',
  //     },
  //   ],
  // },
  // {
  //   label: 'Работа над хостами',
  //   key: 'hosts',
  //   icon: <SettingOutlined />,
  //   children: [
  //     {
  //       label: 'Item 1',
  //       key: 'setting:7',
  //     },
  //     {
  //       label: 'Item 2',
  //       key: 'setting:8',
  //     },
  //   ],
  // },
  // {
  //   key: 'UI',
  //   label: (
  //     <a href="https://ant.design" target="_blank" rel="noopener noreferrer">
  //       UI взят отсюда
  //     </a>
  //   ),
  // },
];
const MainMenu = () => {
  const [current, setCurrent] = useState('mail');
  const onClick = (e) => {
    setCurrent(e.key);
  };
  return (
    <>
      <Menu onClick={onClick} selectedKeys={[current]} mode="horizontal" items={items} />
    </>
  )
};
export default MainMenu;