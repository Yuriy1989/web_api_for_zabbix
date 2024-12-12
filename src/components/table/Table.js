import Table from "@mui/material/Table";
import { styled } from "@mui/material/styles";
import TableCell, { tableCellClasses } from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const TableData = ({ dataZabbix = [] }) => {
  const StyledTableCell = styled(TableCell)(({ theme }) => ({
    [`&.${tableCellClasses.head}`]: {
      backgroundColor: theme.palette.common.black,
      color: theme.palette.common.white,
      fontSize: 12,
    },
    [`&.${tableCellClasses.body}`]: {
      fontSize: "0.75rem",
      maxWidth: "150px",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
  }));

  const StyledTableRow = styled(TableRow)(({ theme }) => ({
    "&:nth-of-type(odd)": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:last-child td, &:last-child th": {
      border: 1,
    },
  }));

  return (
    <Paper sx={{ width: "100%", overflow: "hidden" }}>
      <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
        <Table
          stickyHeader
          sx={{ minWidth: "100%", tableLayout: "hidden" }}
          size="small"
          aria-label="a dense sticky table"
        >
          <TableHead>
            <TableRow>
              <StyledTableCell align="center" sx={{ width: "5%" }}>
                #
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "15%" }}>
                Наименование host
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                Примечание по host
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "15%" }}>
                tags по host
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "5%" }}>
                Приоритет
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "20%" }}>
                Описание trigger
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                tags по trigger
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                expression
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "20%" }}>
                status
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                Примечание по триггеру
              </StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dataZabbix?.length > 0 ? (
              dataZabbix?.map((row, index) => (
                <StyledTableRow
                  key={index}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <StyledTableCell align="center" component="th" scope="row">
                    {index + 1}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.hosts?.[0]?.name}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.hosts?.[0]?.description}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {Array.isArray(row?.tags)
                      ? row?.tags
                          .map((item) => `${item.tag}: ${item.value}`)
                          .join(", ")
                      : "-"}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.priority}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {row?.description}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                  {Array.isArray(row?.hosts?.[0]?.tags)
                      ? row?.hosts?.[0]?.tags
                          .map((item) => `${item.tag}: ${item.value}`)
                          .join(", ")
                      : "-"}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {row?.expression}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.status}
                  </StyledTableCell>
                  <StyledTableCell align="left">
                    {row?.comments}
                  </StyledTableCell>
                </StyledTableRow>
              ))
            ) : (
              <TableRow>
                <StyledTableCell colSpan={10} align="center">
                  No data available
                </StyledTableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default TableData;
