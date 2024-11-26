import Table from "@mui/material/Table";
import { styled } from '@mui/material/styles';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import { useState } from "react";

const TableData = ({dataZabbix = []}) => {
  const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
      backgroundColor: theme.palette.common.black,
      color: theme.palette.common.white,
    },
    [`&.${tableCellClasses.body}`]: {
      fontSize: 14,
    },
  }));

  const StyledTableRow = styled(TableRow)(({ theme }) => ({
    '&:nth-of-type(odd)': {
      backgroundColor: theme.palette.action.hover,
    },
    // hide last border
    '&:last-child td, &:last-child th': {
      border: 0,
    },
  }));

  return (
    <TableContainer component={Paper}  sx={{ maxHeight: 440 }}>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="sticky table">
        <TableHead>
          <TableRow>
            <StyledTableCell align="center">#</StyledTableCell>
            <StyledTableCell align="center">Наименование host</StyledTableCell>
            <StyledTableCell align="center">Примечание по host</StyledTableCell>
            <StyledTableCell align="center">Описание tags по host</StyledTableCell>
            <StyledTableCell align="center">Приоритет</StyledTableCell>
            <StyledTableCell align="center">Описание trigger</StyledTableCell>
            <StyledTableCell align="center">triggerid</StyledTableCell>
            <StyledTableCell align="center">expression</StyledTableCell>
            <StyledTableCell align="center">
              status (0 - антивен, 1 - выключен)
            </StyledTableCell>
            <StyledTableCell align="center">Примечание по триггеру</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {dataZabbix?.length > 0 ? (
            dataZabbix?.map((row, index) => (
              <StyledTableRow
                key={index}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell align="center" component="th" scope="row">
                  {index+1}
                </TableCell>
                <TableCell align="center">{row?.hosts[0].name}</TableCell>
                <TableCell align="center">{row?.hosts[0].description}</TableCell>
                <TableCell align="center">{row?.hosts[0].description}</TableCell>
                <TableCell align="center">{row?.status}</TableCell>
                <TableCell align="left">{row?.comments}</TableCell>
                <TableCell align="left">{row?.description}</TableCell>
                <TableCell align="left">{row?.triggerid}</TableCell>
                <TableCell align="left">{row?.expression}</TableCell>
                <TableCell align="left">{row?.comments}</TableCell>
              </StyledTableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} align="center">
                No data available
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default TableData;
