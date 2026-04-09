const Course = require("../Models/Courses");
const Lesson = require("../Models/Lessons");
const Progress = require("../Models/Progress");
const Activity = require("../Models/ActivityHistory");
const multer = require("multer");
const ActivityHistory = require("../Models/ActivityHistory");
const {
  deleteCloudinaryAsset,
  uploadBufferToCloudinary,
} = require("../Utils/cloudinary");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

//Create a new lesson
exports.createLesson = async (req, res) => {
  try {
    // Middleware xử lý 1 video và 1 document
    const uploadMiddleware = upload.fields([
      { name: "video", maxCount: 1 },
      { name: "document", maxCount: 1 },
    ]);

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "File upload error" });
      }

      const course_id = req.params.course_id;
      const course = await Course.findById({
        _id: course_id,
        teacher_id: req.user._id,
      });
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      if (course.status) {
        return res
          .status(400)
          .json({ message: "Course is active, cannot create lesson." });
      }

      const { number, title, description } = req.body;
      const existLesson = await Lesson.findOne({ course_id, number });
      if (existLesson) {
        return res.status(400).json({ message: "Lesson already exists" });
      }
      if (!number || !title || !description) {
        return res.status(400).json({
          message: "All fields (number, title, description) are required",
        });
      }

      let videoUrl = null;
      let documentUrl = null;

      // Upload video nếu tồn tại
      if (req.files?.video && req.files.video.length > 0) {
        const uploadResult = await uploadBufferToCloudinary(
          req.files.video[0].buffer,
          {
            folder: `courses/${course._id}/lessons/${number}/${title}/videos`,
            public_id: `video_${Date.now()}`,
            resource_type: "video",
          }
        );
        videoUrl = uploadResult.secure_url;
      }

      // Upload document nếu tồn tại
      if (req.files?.document && req.files.document.length > 0) {
        const uploadResult = await uploadBufferToCloudinary(
          req.files.document[0].buffer,
          {
            folder: `courses/${course._id}/lessons/${number}/${title}/documents`,
            public_id: `document_${Date.now()}`,
            resource_type: "auto",
          }
        );
        documentUrl = uploadResult.secure_url;
      }

      // Tạo bài học mới
      const lesson = new Lesson({
        course_id,
        number,
        title,
        description,
        video_url: videoUrl,
        document_url: documentUrl,
      });

      const progresses = await Progress.find({ course_id });
      // Tạo progress cho bài học mới đối với những progress chưa hoàn thành tất cả
      // Nếu bài học đã hoàn thành thì không cần tạo progress mới
      for (const progressItem of progresses) {
        if (progresses.final_exam?.status === "Completed") {
          continue;
        } else {
          const lessonIndex = progressItem.lesson.findIndex(
            (item) => item.lesson_id.toString() === lesson._id.toString()
          );
          if (lessonIndex === -1) {
            progressItem.lesson.push({
              lesson_id: lesson._id,
              status: "Not Started",
              note: "",
              progress_time: 0,
            });
            await progressItem.save();
          }
        }
      }

      const newActivity = new ActivityHistory({
        user: req.user._id,
        role: "Tutor",
        description: `Created lesson ${title} for course ${course.title}`,
      });
      await newActivity.save();

      await lesson.save();
      res.status(201).json(lesson);
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//Get all lessons of a course
exports.getAllLessons = async (req, res) => {
  try {
    const course_id = req.params.course_id;
    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lessons = await Lesson.find({ course_id }).sort({ number: 1 });

    res.json(lessons);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//Get a lesson by id
exports.getLessonById = async (req, res) => {
  try {
    const lesson_id = req.params.lesson_id;
    const lesson = await Lesson.findById(lesson_id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }
    res.json(lesson);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//Update a lesson
exports.updateLesson = async (req, res) => {
  try {
    const lesson_id = req.params.lesson_id;
    const lesson = await Lesson.findById(lesson_id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const course_id = lesson.course_id;
    const course = await Course.findOne({
      _id: course_id,
      tutor: req.user._id,
    });
    if (!course) {
      return res
        .status(404)
        .json({ message: "You are not tutor of this course" });
    }
    if (course.status) {
      return res
        .status(400)
        .json({ message: "Course is active, cannot update lesson." });
    }

    const uploadMiddleware = upload.fields([
      { name: "video", maxCount: 1 },
      { name: "document", maxCount: 1 },
    ]);

    uploadMiddleware(req, res, async (err) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ message: "File upload error" });
      }

      const newTitle = req.body.title;
      const description = req.body.description;

      if (newTitle) {
        lesson.title = newTitle;
      }
      if (description) {
        lesson.description = description;
      }

      // Update video
      if (req.files?.video && req.files.video.length > 0) {
        const previousVideoUrl = lesson.video_url;
        const uploadResult = await uploadBufferToCloudinary(
          req.files.video[0].buffer,
          {
            folder: `courses/${course._id}/lessons/${lesson.number}/${lesson.title}/videos`,
            public_id: `video_${Date.now()}`,
            resource_type: "video",
          }
        );
        lesson.video_url = uploadResult.secure_url;
        await deleteCloudinaryAsset(previousVideoUrl);
      }

      // Update document
      if (req.files?.document && req.files.document.length > 0) {
        const previousDocumentUrl = lesson.document_url;
        const uploadResult = await uploadBufferToCloudinary(
          req.files.document[0].buffer,
          {
            folder: `courses/${course._id}/lessons/${lesson.number}/${lesson.title}/documents`,
            public_id: `document_${Date.now()}`,
            resource_type: "auto",
          }
        );
        lesson.document_url = uploadResult.secure_url;
        await deleteCloudinaryAsset(previousDocumentUrl);
      }

      const newActivity = new ActivityHistory({
        user: req.user._id,
        role: "Tutor",
        description: `Updated lesson ${lesson.title} for course ${course.title}`,
      });
      await newActivity.save();

      await lesson.save();
      res.status(200).json({ message: "Lesson updated successfully", lesson });
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    const lesson_id = req.params.lesson_id;
    const lesson = await Lesson.findById(lesson_id);
    if (!lesson) {
      return res.status(404).json({ message: "Lesson not found" });
    }

    const course_id = lesson.course_id;
    const course = await Course.findOne({
      _id: course_id,
      tutor: req.user._id,
    });
    if (!course) {
      return res
        .status(404)
        .json({ message: "You are not tutor of this course" });
    }
    if (course.status) {
      return res
        .status(400)
        .json({ message: "Course is active, cannot delete lesson." });
    }

    await deleteCloudinaryAsset(lesson.video_url);
    await deleteCloudinaryAsset(lesson.document_url);
    await lesson.deleteOne();

    const progresses = await Progress.find({ course_id: lesson.course_id });
    //nếu những progress nào hoàn thành hết thì không cập nhật thêm
    //chỉ cập nhật những progress nào chưa hoàn thành
    for (const progressItem of progresses) {
      const lessonIndex = progressItem.lesson.findIndex(
        (item) => item.lesson_id.toString() === lesson._id.toString()
      );
      if (lessonIndex !== -1) {
        progressItem.lesson.splice(lessonIndex, 1);
        await progressItem.save();
      }
    }

    res.json({ message: "Lesson deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
