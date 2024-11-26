import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const TableData = (dataZabbix) => {
  console.log("dataTable", dataZabbix);
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            <TableCell>Dessert (100g serving)</TableCell>
            <TableCell align="right">Наименование host</TableCell>
            <TableCell align="right">Примечание по host</TableCell>
            <TableCell align="right">Описание tags по host</TableCell>
            <TableCell align="right">Приоритет</TableCell>
            <TableCell align="right">Описание trigger</TableCell>
            <TableCell align="right">triggerid</TableCell>
            <TableCell align="right">expression</TableCell>
            <TableCell align="right">status (0 - антивен, 1 - выключен)</TableCell>
            <TableCell align="right">Примечание по триггеру</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {dataZabbix?.length > 0 ? (
            dataZabbix?.map((row) => (
              <TableRow
                key={row.hosts[0].name}
                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {row.name}
                </TableCell>
                <TableCell align="right">{row?.hosts[0].name}</TableCell>
                <TableCell align="right">{row?.hosts[0].description}</TableCell>
                <TableCell align="right">{row?.hosts[0].description}</TableCell>
                <TableCell align="right">{row?.status}</TableCell>
                <TableCell align="right">{row?.comments}</TableCell>
                <TableCell align="right">{row?.description}</TableCell>
                <TableCell align="right">{row?.triggerid}</TableCell>
                <TableCell align="right">{row?.expression}</TableCell>
              </TableRow>
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
