import * as React from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TaskProperties } from '../../../../_mockApis/kanban/KanbanData';
import { Button, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Grid from '@mui/material/Grid2';
import CustomFormLabel from 'src/components/forms/theme-elements/CustomFormLabel';
import CustomTextField from 'src/components/forms/theme-elements/CustomTextField';
import CustomSelect from 'src/components/forms/theme-elements/CustomSelect';

function AddNewList({
  show,
  onHide,
  onSave,
  newTaskData,
  setNewTaskData,
  updateTasks,
}) {
  const { task, taskText, taskProperty, taskImage } = newTaskData;

  //Function to handle saving changes and updating tasks
  const handleSave = () => {
    // Update the task data with the default date if needed
    setNewTaskData({ ...newTaskData });
    onSave();
    updateTasks();
  };



  const isFormValid = () => {
    return task && taskText && taskProperty && taskImage;
  };


  return (
    (<Dialog
      open={show}
      onClose={onHide}
      PaperProps={{
        component: "form",
      }}
    >
      <DialogTitle>Add Task</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            {/* task title */}
            <CustomFormLabel
              sx={{
                mt: 0,
              }}
              htmlFor="task"
            >
              Task Title *
            </CustomFormLabel>
            <CustomTextField
              id="task"
              variant="outlined"
              fullWidth
              value={task}
              onChange={(e) =>
                setNewTaskData({ ...newTaskData, task: e.target.value })
              }
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            {/* task text */}
            <CustomFormLabel
              htmlFor="taskText"
              sx={{
                mt: 0,
              }}
            >
              Text*
            </CustomFormLabel>
            <CustomTextField
              id="taskText"
              variant="outlined"
              fullWidth
              value={taskText}
              onChange={(e) =>
                setNewTaskData({ ...newTaskData, taskText: e.target.value })
              }
            />
          </Grid>
          <Grid size={12}>
            {/* task image */}
            <CustomFormLabel
              htmlFor="taskImage"
              sx={{
                mt: 0,
              }}
            >
              Image URL*
            </CustomFormLabel>
            <CustomTextField
              id="taskImage"
              variant="outlined"
              fullWidth
              value={taskImage}
              onChange={(e) =>
                setNewTaskData({ ...newTaskData, taskImage: e.target.value })
              }
            />
            {taskImage !== undefined && (
              <img
                width={200}
                height={200}
                src={taskImage}
                alt="Selected"
                style={{ marginTop: "8px" }}
              />
            )}
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 6
            }}>
            {/* task image */}
            <CustomFormLabel
              htmlFor="taskProperty"
              sx={{
                mt: 0,
              }}
            >
              Task Property *
            </CustomFormLabel>
            <CustomSelect
              fullWidth
              id="taskProperty"
              variant="outlined"
              value={taskProperty}
              onChange={(e) =>
                setNewTaskData({ ...newTaskData, taskProperty: e.target.value })
              }
            >
              <MenuItem value="">Select Task Property</MenuItem>
              {TaskProperties.map((property) => (
                <MenuItem key={property} value={property}>
                  {property}
                </MenuItem>
              ))}
            </CustomSelect>
          </Grid>

        </Grid>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" color="error" onClick={onHide}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isFormValid()}
        >
          Add Task
        </Button>
      </DialogActions>
    </Dialog>)
  );
}

export default AddNewList;
