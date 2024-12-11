import Table from "@mui/material/Table";
import { styled } from "@mui/material/styles";
import TableCell, { tableCellClasses } from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

const TableDataHosts = ({ dataZabbixHosts = [] }) => {
  console.log('dataZabbixHosts', dataZabbixHosts);
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
                host
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                hostid
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "15%" }}>
                name
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "5%" }}>
                interfaces
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "20%" }}>
                description
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: "10%" }}>
                status
              </StyledTableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dataZabbixHosts?.length > 0 ? (
              dataZabbixHosts?.map((row, index) => (
                <StyledTableRow
                  key={index}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <StyledTableCell align="center" component="th" scope="row">
                    {index + 1}
                  </StyledTableCell>
                  <StyledTableCell align="center">{row?.host}</StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.hostid}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {row?.name}
                  </StyledTableCell>
                  <StyledTableCell align="left">{row?.interfaces[0]?.ip}</StyledTableCell>
                  <StyledTableCell align="left">{row?.description}</StyledTableCell>
                  <StyledTableCell align="left">{row?.triggerid}</StyledTableCell>
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

export default TableDataHosts;
