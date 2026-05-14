
import { useContext, useState } from 'react';
import { IconPencil, IconDotsVertical, IconTrash, IconCalendar } from '@tabler/icons';
import EditTaskModal from './TaskModal/EditTaskModal';
import { KanbanDataContext } from 'src/context/kanbancontext/index';
import { Draggable } from '@hello-pangea/dnd';
import axios from 'src/utils/axios';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import {
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import BlankCard from '../../shared/BlankCard';
import dayjs from "dayjs";

const TaskData = ({ task, onDeleteTask, index }) => {
  const { setError } = useContext(KanbanDataContext);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedTask, setEditedTask] = useState(task);
  const [anchorEl, setAnchorEl] = useState(null);

  const handleShowEditModal = () => { setShowEditModal(true); handleClose(); }
  const handleCloseEditModal = () => setShowEditModal(false);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };


  const handleDeleteClick = () => onDeleteTask(task.id);

  const handleSaveEditedTask = async (editedTaskData) => {
    try {
      const response = await axios.put('/api/TodoData/editTask', {
        taskId: editedTaskData.id,
        newData: editedTaskData,
      });
      if (response.status === 200) {
        setEditedTask(editedTaskData);
      } else {
        throw new Error('Failed to edit task');
      }
    } catch (error) {
      setError(error.message);
    }
  };

  const formatDate = (date) => {
    if (date) {
      // If the date is provided, format it to 'DD MMM' (Day and Month)
      const parsedDate = dayjs(date, "DD MMMM", true); // strict parsing mode
      if (parsedDate.isValid()) {
        return parsedDate.format("DD MMM");
      } else {
        // If invalid, try to append the current year
        const currentYear = dayjs().year();
        const newDate = `${date} ${currentYear}`; // Example: '24 july 2024'
        const correctedDate = dayjs(newDate, "DD MMMM YYYY");
        return correctedDate.isValid() ? correctedDate.format("DD MMM") : dayjs().format("DD MMM");
      }
    } else {
      // If the date is not provided, return today's date in 'DD MMM' format
      return dayjs().format("DD MMM");
    }
  };

  const taskDate = formatDate(editedTask.date); // Get formatted task date


  const backgroundColor =
    editedTask.taskProperty === "Design"
      ? "success.main"
      : editedTask.taskProperty === "Development"
        ? "warning.main"
        : editedTask.taskProperty === "Mobile"
          ? "primary.main"
          : editedTask.taskProperty === "UX Stage"
            ? "warning.main"
            : editedTask.taskProperty === "Research"
              ? "secondary.main"
              : editedTask.taskProperty === "Data Science"
                ? "error.main"
                : editedTask.taskProperty === "Branding"
                  ? "success.main"
                  : "primary.contrastText";

  return (
    (<Draggable draggableId={task.id} index={index}>
      {(provided) => (
        <Box
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          sx={{
            mb: 3
          }}>
          <BlankCard>
            <Box
              sx={{
                px: 2,
                py: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
              <Typography variant="h6" sx={{
                fontSize: "14px"
              }}>
                {editedTask.task}
              </Typography>
              <Box>
                <IconButton
                  aria-label="more"
                  aria-controls="long-menu"
                  aria-haspopup="true"
                  onClick={handleClick}

                >
                  <IconDotsVertical size="1rem" />
                </IconButton>
                <Menu
                  id="long-menu"
                  anchorEl={anchorEl}
                  keepMounted
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                >
                  <MenuItem onClick={handleShowEditModal}>
                    <ListItemIcon>
                      <IconPencil size="1.2rem" />
                    </ListItemIcon>
                    <ListItemText> Edit</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={handleDeleteClick}>
                    <ListItemIcon>
                      <IconTrash size="1.2rem" />{" "}
                    </ListItemIcon>
                    <ListItemText> Delete</ListItemText>
                  </MenuItem>
                </Menu>
                <EditTaskModal
                  show={showEditModal}
                  onHide={handleCloseEditModal}
                  task={task}
                  editedTask={editedTask}
                  onSave={handleSaveEditedTask}
                />
              </Box>
            </Box>
            <Box>
              {editedTask.taskImage && (
                <img
                  src={editedTask.taskImage}
                  alt="Task Image"
                  className="img-fluid"
                  style={{ width: "100%", height: "106px" }}
                />
              )}
            </Box>
            {editedTask.taskText && (
              <Box
                sx={{
                  px: 2,
                  py: 1
                }}>
                <Typography variant="body2">{editedTask.taskText}</Typography>
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 2,
                py: 1
              }}>
              <Stack direction="row" sx={{
                gap: 1
              }}>
                <IconCalendar size="1rem" />
                <Typography variant="body2">
                  {taskDate}
                </Typography>
              </Stack>
              <Box>
                <Chip
                  size="small"
                  label={editedTask.taskProperty}
                  sx={{
                    backgroundColor,
                    color: "white",
                    borderRadius: "8px",
                    fontSize: "11px",
                    fontWeight: 400,
                  }}
                />
              </Box>
            </Box>
          </BlankCard>
        </Box>
      )}
    </Draggable>)
  );
};

export default TaskData;

